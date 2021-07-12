function encodeBase64(data) {
    let buff = new Buffer(data);
    return buff.toString("base64");
}


module.exports = {
    encodeBase64
};
