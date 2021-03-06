const {createBucket, getBuckets} = require("./forge/oss");
const {getManifest, getDerivativeManifestInfo} = require("./forge/modelderivative");
const {uploadFileToForge, downloadForgeFile} = require("./forge/forge-helper");


module.exports = function (app, checkJwt) {

    app.post("/forge/bucket", async (req, res) => {
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


    app.get("/forge/list", async (req, res) => {
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

    app.get("/forge/manifest/:urn", async (req, res) => {
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

    app.get("/forge/info/:urn/:derivativeUrn", async (req, res) => {
        const urn = req.params.urn;
        const derivativeUrn = req.params.derivativeUrn;

        try {
            const {body} = await getDerivativeManifestInfo(urn, derivativeUrn);
            console.log(body);
            res.json({info: body});
        } catch (e) {
            console.log(e);
            res.status(e.statusCode);
            res.send({error: e.statusBody});
        }
    });

    // DEVING routes - NOT USED IN PROD
    app.get("/forge/convert", async (req, res) => {
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

    // DEVING routes  - NOT USED IN PROD
    app.get("/forge/download", async (req, res) => {

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
