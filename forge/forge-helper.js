const {uploadFileChunked} = require("./oss");
const {encodeBase64, folderExistsOrCreate} = require("../utils");
const {getManifest, downloadTranslatedFile, translateJob, getDerivativeManifestInfo} = require("./modelderivative");
const fs = require("fs");
const async = require("async");

async function uploadFileToForge(filePath, ossSourceFileObjectKey) {
    const bucketKey = "thiele-conversion";

    const res = await uploadFileChunked(filePath, ossSourceFileObjectKey, bucketKey, {onProgress: prog => console.log(prog)});

    const ossSourceFileURN = res.objectId;
    const ossEncodedSourceFileURN = encodeBase64(ossSourceFileURN);
    return await translateJob(ossEncodedSourceFileURN);
}


async function downloadForgeFile(user, encodedSourceURN, fileName, downloadJob, opts = {}) {
    const {body} = await getManifest(encodedSourceURN);

    if (body.progress !== "complete") {
        throw new Error(`Translation for {${fileName}} not finished yet`);
    }

    if (downloadJob.downloading) {
        throw new Error(`Job for {${fileName}} already downloading`);
    }

    downloadJob.downloading = true;
    console.log(`Job for {${fileName}} started downloading`);

    const objDerivative = body.derivatives.find(derivative => derivative.outputType === "obj");
    const objChild = objDerivative.children.find(child => child.urn.endsWith(".obj"));

    if (!objChild) {
        throw new Error("No obj child found in derivatives!");
    }

    const convertedFileName = fileName.split(".")[0] + ".obj";

    const objectInfo = await getDerivativeManifestInfo(encodedSourceURN, objChild.urn);
    const chunkSize = 5 * 1024 * 1024;
    const fileSize = +objectInfo.headers["content-length"];
    const nbChunks = Math.ceil(fileSize / chunkSize);
    const chunksMap = Array.from({length: nbChunks}, (e, i) => i);

    console.log(`Detected ${nbChunks} chunks. Total size: ${Math.round(fileSize / 1024)}KB`);

    const filePath = `conversions/${user}`;
    const conversionPath = `${filePath}/${convertedFileName}`;
    folderExistsOrCreate(filePath);

    const writer = fs.createWriteStream(conversionPath);
    writer.on("error", console.error);

    // prepare the download tasks
    const downloadTasks = chunksMap.map((chunkIdx) => {

        const start = chunkIdx * chunkSize;
        const end = Math.min(fileSize, (chunkIdx + 1) * chunkSize) - 1;
        const range = `bytes ${start}-${end}`;

        const run = async () => {
            const res = await downloadTranslatedFile(encodedSourceURN, objChild.urn, {range});
            writer.write(res.body);
        };

        return {
            chunkIndex: chunkIdx,
            run
        };
    });

    return new Promise((resolve, reject) => {
        let progress = 0;

        async.each(downloadTasks, (task, callback) => {
            task.run().then(() => {
                if (opts.onProgress) {
                    progress += 100.0 / nbChunks;
                    opts.onProgress({
                                        progress: Math.round(progress * 100) / 100,
                                        chunkIndex: task.chunkIndex
                                    });
                }
                callback();
            }, (error) => {
                console.log(error);
                callback(error);
            });

        }, (error) => {
            console.log("Finished downloading all chunks.");
            writer.close();
            if (error) {
                return reject(error);
            }
            return resolve();
        });
    });
}

module.exports = {
    uploadFileToForge,
    downloadForgeFile
};
