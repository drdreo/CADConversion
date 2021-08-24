const {uploadFile, uploadFileChunked} = require("./oss");
const {encodeBase64} = require("../utils");
const {getManifest, downloadTranslatedFile, translateJob} = require("./modelderivative");
const {writeFile} = require("fs");

async function uploadFileToForge(filePath, ossSourceFileObjectKey) {
    const bucketKey = "thiele-conversion";

    const res = await uploadFileChunked(filePath, ossSourceFileObjectKey, bucketKey, {onProgress: prog => console.log(prog)});

    const ossSourceFileURN = res.objectId;
    const ossEncodedSourceFileURN = encodeBase64(ossSourceFileURN);
    return await translateJob(ossEncodedSourceFileURN);
}


async function downloadForgeFile(user, encodedSourceURN, fileName, downloadJob) {
    const {body} = await getManifest(encodedSourceURN);

    if (body.progress !== "complete") {
        throw new Error(`Translation for {${fileName}} not finished yet`);
    }

    if (downloadJob.downloading) {
        throw new Error(`Job for {${fileName}} already downloading`);
    }

    downloadJob.downloading = true;

    const objDerivative = body.derivatives.find(derivative => derivative.outputType === "obj");
    const objChild = objDerivative.children.find(child => child.urn.endsWith(".obj"));
    console.log(objChild);
    if (!objChild) {
        throw new Error("No obj child found in derivatives!");
    }

    const convertedFileName = fileName.split(".")[0] + ".obj";

    // TODO: download in chunks and write in chunks
    const download = await downloadTranslatedFile(encodedSourceURN, objChild.urn);
    return new Promise((resolve, reject) => {
        const conversionPath = `conversions/${user}/${convertedFileName}`;
        writeFile(conversionPath, download.body, err => {
            if (err) {
                console.error(err);
                return reject(err.message);
            }
            resolve({downloadPath: conversionPath});
        });
    });
}

module.exports = {
    uploadFileToForge,
    downloadForgeFile
};
