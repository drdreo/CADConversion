const crypto = require("crypto");
const fs = require("fs");

function encodeBase64(data) {
    let buff = new Buffer(data);
    return buff.toString("base64");
}

function generateGUID(){
    return crypto.randomBytes(16).toString("hex");
}

function folderExistsOrCreate(folderName) {
    try {
        fs.accessSync(folderName);
    } catch (err) {
        fs.mkdirSync(`${folderName}`);
    }
}

module.exports = {
    encodeBase64,
    generateGUID,
    folderExistsOrCreate
};
