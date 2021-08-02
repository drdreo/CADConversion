const {createBucket, getBuckets} = require("./forge/oss");
const {getManifest} = require("./forge/modelderivative");
const {uploadFileToForge, downloadForgeFile} = require("./forge/forge-helper");


module.exports = function (app, checkJwt) {

    app.post("/api/forge/bucket", async (req, res) => {
        const bucketName = req.body.bucket || "thiele-conversion";

        try {
            const {body} = await createBucket(bucketName);
            console.dir(body);
            res.json({buckets: body});
        } catch (e) {
            console.log(e);
            res.status(e.statusCode);
            res.send({error: e.statusBody});
        }
    });


    app.get("/api/forge/list", async (req, res) => {
        const bucketKey = "thiele-conversion";

        try {
            const {body} = await getBuckets(bucketKey);
            console.log(body);
            res.json({buckets: body});
        } catch (e) {
            console.log(e);
            res.status(e.statusCode);
            res.send({error: e.statusBody});
        }
    });

    app.get("/api/forge/manifest/:urn", async (req, res) => {
        const urn = req.params.urn;

        try {
            const {body} = await getManifest(urn);
            console.log(body);
            res.json({manifest: body});
        } catch (e) {
            console.log(e);
            res.status(e.statusCode);
            res.send({error: e.statusBody});
        }
    });

    app.get("/api/forge/convert", async (req, res) => {
        const filePath = "samples/bauplan.stp";

        const ossSourceFileObjectKey = "bauplan.stp";

        try {
            const translateResponse = await uploadFileToForge(filePath, ossSourceFileObjectKey);

            res.json({success: translateResponse.body});
        } catch (err) {
            console.log(err);
            res.status(err.statusCode);
            res.send({error: err.statusBody});
        }

    });

    app.get("/api/forge/download", async (req, res) => {

        const fileName = "fuck-this.obj";

        const encodedSourceURN = "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dGhpZWxlLWNvbnZlcnNpb24vYmF1cGxhbi5zdHA";

        downloadForgeFile(encodedSourceURN, fileName).then(success => {
            console.log(`Converted successfully - /conversions/${fileName}`);
            res.json(success);
        }).catch(error => {
            console.log(error);
            res.status(error.statusCode || 500);
            res.send({error: error.statusBody});
        });

    });
};
