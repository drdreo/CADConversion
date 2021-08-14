const {uploadFile} = require("./oss");
const {encodeBase64} = require("../utils");
const {getManifest, downloadTranslatedFile, translateJob} = require("./modelderivative");
const {writeFile} = require("fs");

async function uploadFileToForge(filePath, ossSourceFileObjectKey) {
    const bucketKey = "thiele-conversion";

    const {body} = await uploadFile(filePath, ossSourceFileObjectKey, bucketKey);
    console.log(body);

    const ossSourceFileURN = body.objectId;
    const ossEncodedSourceFileURN = encodeBase64(ossSourceFileURN);
    return await translateJob(ossEncodedSourceFileURN);
}


async function downloadForgeFile(encodedSourceURN, fileName) {
    const {body} = await getManifest(encodedSourceURN);

    if (body.progress !== "complete") {
        throw new Error(`Translation for {${fileName}} not finished yet`);
    }

    const objDerivative = body.derivatives.find(derivative => derivative.outputType === "obj");
    const objChild = objDerivative.children.find(child => child.urn.endsWith(".obj"));
    console.log(objChild);
    if (!objChild) {
        throw new Error("No obj child found in derivatives!");
    }

    const convertedFileName = fileName.split('.')[0] + '.obj';

    const download = await downloadTranslatedFile(encodedSourceURN, objChild.urn);
    return new Promise((resolve, reject) => {
        writeFile(`conversions/${convertedFileName}`, download.body, err => {
            if (err) {
                console.error(err);
                reject(err.message);
                return;
            }
            console.log(`Converted ${fileName} successfully - /conversions/${convertedFileName}`);
            resolve({downloadPath: `/conversions/${convertedFileName}`});
        });
    });
}

module.exports = {
    uploadFileToForge,
    downloadForgeFile
};
