const crypto = require("crypto");

function encodeBase64(data) {
    let buff = new Buffer(data);
    return buff.toString("base64");
}

function generateGUID(){
    return crypto.randomBytes(16).toString("hex");
}

module.exports = {
    encodeBase64,
    generateGUID
};
