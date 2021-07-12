const {downloadTranslatedFile} = require("./forge/modelderivative");
const {encodeBase64} = require("./utils");

const {createBucket, uploadFile, getBuckets} = require("./forge/oss");
const {getManifest, translateJob} = require("./forge/modelderivative");

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

        const bucketKey = "thiele-conversion";
        const ossSourceFileObjectKey = "bauplan.stp";

        try {
            const {body} = await uploadFile(filePath, ossSourceFileObjectKey, bucketKey);
            console.log(body);

            const ossSourceFileURN = body.objectId;
            const ossEncodedSourceFileURN = encodeBase64(ossSourceFileURN);
            const translateResponse = await translateJob(ossEncodedSourceFileURN);

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

        try {
            const {body} = await getManifest(encodedSourceURN);

            if (body.progress !== "complete") {
                res.status(500);
                res.send({error: "Translation not finished yet"});
                return;
            }

            const objDerivative = body.derivatives.find(derivative => derivative.outputType === "obj");
            const objChild = objDerivative.children.find(child => child.urn.endsWith(".obj"));
            console.log(objChild);
            if (!objChild) {
                throw new Error("No obj child found in derivatives!");
            }

            const download = await downloadTranslatedFile(encodedSourceURN, objChild.urn);
            console.log(download);
            fs.writeFile(`conversions/${fileName}`, download.body, err => {
                if (err) {
                    console.error(err);
                    res.json({error: err.message});
                    return;
                }
                console.log(`Converted successfully - /conversions/${fileName}`);
                res.json({downloadPath: `/conversions/${fileName}`});
            });
        } catch (err) {
            console.log(err);
            res.status(err.statusCode);
            res.send({error: err.statusBody});
        }

    });
};
