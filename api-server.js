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


app.get("/api/forge/test", async (req, res) => {
    const filePath = "test.STEP";
    // const {body} = await createBucket("thiele-test");
    // console.dir(body);
    const bucketKey = "whqpeh6ubyuda9okxvapaca0dabi2xt4-thiele-test";

    uploadFile(filePath, "step-test-file", bucketKey).then(async (response) => {
        console.log(response.body);

        const urn = response.body.objectId + ".STEP";
        translateJob(urn)
            .then(async (response) => {

                const download = await downloadFile("step-test-file", bucketKey);
                fs.writeFile("fuck-this.obj", download.body, err => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    //file written successfully
                });
                res.json({success: response.body, download: download.statusCode});
            })
            .catch(err => {
                console.log(err);
                res.status(err.statusCode);
                res.send({error: err.statusBody});
            });
    }).catch(err => {
        console.log(err);
        res.status(err.statusCode);
        res.send({error: err.statusBody});
    });

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
