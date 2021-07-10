const fs = require("fs");

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const bodyParser = require("body-parser");
const multipart = require("connect-multiparty");
const multipartMiddleware = multipart({uploadDir: "./uploads"});

const authConfig = require("./auth_config.json");
const {getManifest} = require("./forge/modelderivative");
const {downloadFile} = require("./forge/oss");
const {getBuckets} = require("./forge/oss");

const {createBucket, uploadFile} = require("./forge/oss");
const {translateJob} = require("./forge/modelderivative");

const app = express();

if (!authConfig.domain || !authConfig.audience || authConfig.audience === "YOUR_API_IDENTIFIER") {
    console.log(
        "Exiting: Please make sure that auth_config.json is in place and populated with valid domain and audience values"
    );

    process.exit();
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
                                  extended: true
                              }));

app.use(morgan("dev"));
app.use(helmet());
app.use(
    cors({
             origin: authConfig.appUri
         })
);


const checkJwt = jwt({
                         secret: jwksRsa.expressJwtSecret({
                                                              cache: true,
                                                              rateLimit: true,
                                                              jwksRequestsPerMinute: 5,
                                                              jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`
                                                          }),

                         audience: authConfig.audience,
                         issuer: `https://${authConfig.domain}/`,
                         algorithms: ["RS256"]
                     });

app.get("/health", (req, res) => {
    res.json({status: "Available"});
});

app.get("/api/files", checkJwt, (req, res, next) => {
    const user = req.user.sub.split("|")[1];

    fs.readdir(`uploads/${user}`, (err, files) => {
        if (err) {
            res.status(500);
            res.send(err.message);
        } else {
            files = files.map(file => {
                return {name: file};
            });
            res.send({files});
        }
    });
});

app.get("/api/files/download/:fileName", checkJwt, (req, res) => {
    const user = req.user.sub.split("|")[1];
    const fileName = req.params.fileName;

    res.download(`uploads/${user}/${fileName}`, fileName, (err) => {
        if (err) {
            res.status(500)
               .send({
                         message: "Could not download the file. " + err
                     });
        }
    });
});

app.post("/api/upload", checkJwt, multipartMiddleware, (req, res) => {

    const user = req.user.sub.split("|")[1]; // remove auth0 from sub
    const files = req.files.uploads;

    renameUploadedFiles(user, files).then(() => {
        console.log("Uploaded files: ", files.map(file => file.name));

        res.json({
                     "message": "File uploaded successfully"
                 });
    }).catch(err => {
        res.status(500)
           .send({
                     message: "Could not upload file. " + err
                 });
    });
});


app.post("/api/forge/bucket", async (req, res) => {
    const bucketName = req.body.bucket || "thiele-test";

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
    const bucketKey = "whqpeh6ubyuda9okxvapaca0dabi2xt4-thiele-test";

    try {
        const response = await getBuckets(bucketKey);
        console.log(response);
        res.json({buckets: response.body});
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
    const filePath = "samples/airboat.obj";

    const bucketKey = "whqpeh6ubyuda9okxvapaca0dabi2xt4-thiele-test";

    try {
        const {body} = await uploadFile(filePath, "step-test", bucketKey);
        console.log(body);

        const objectId = body.objectId + ".obj";

        const translateResponse = await translateJob(objectId);
        console.log(translateResponse.body);
        // const download = await downloadFile("step-test-file", bucketKey);
        // fs.writeFile("fuck-this.obj", download.body, err => {
        //     if (err) {
        //         console.error(err);
        //         return;
        //     }
        //     //file written successfully
        // });
        res.json({success: translateResponse.body});


    } catch (err) {
        console.log(err);
        res.status(err.statusCode);
        res.send({error: err.statusBody});
    }


    // const testUrn = "urn:adsk.objects:os.object:whqpeh6ubyuda9okxvapaca0dabi2xt4-thiele-test/step-test-file";
    // translateJob(testUrn)
    //     .then(console.log)
    //     .catch(err => {
    //         console.log(err);
    //         res.status(err.statusCode);
    //         res.send({error: err.statusBody});
    //     });
});


const port = process.env.API_SERVER_PORT || 3001;

app.listen(port, () => console.log(`Conversion API listening on port ${port}`));


function renameUploadedFiles(user, files) {
    return new Promise((resolve, reject) => {
        fs.access(`uploads/${user}`, (error) => {
            if (error) {
                // Directory does not exist
                fs.mkdirSync(`uploads/${user}`);
            }

            for (let file of files) {
                fs.rename(file.path, `uploads/${user}/${file.originalFilename}`, function (err) {
                    if (err) {
                        console.log("ERROR: " + err);
                        reject(err);
                    }
                });
            }
            resolve();
        });
    });
}
