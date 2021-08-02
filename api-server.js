const fs = require("fs");

const dotenv = require("dotenv");
dotenv.config();
const UPLOAD_DIR = "uploads";

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const bodyParser = require("body-parser");
const multipart = require("connect-multiparty");
const multipartMiddleware = multipart({uploadDir: UPLOAD_DIR});

const authConfig = require("./auth_config.json");
const {uploadFileToForge, downloadForgeFile} = require("./forge/forge-helper");

const app = express();
const unfinishedTranslations = [];


function requestLogger(httpModule) {
    const original = httpModule.request;
    httpModule.request = function (options, callback) {
        console.log(options.method, options.href || options.proto + "://" + options.host + options.path);
        return original(options, callback);
    };
}

requestLogger(require("http"));
requestLogger(require("https"));

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

app.use("/conversions", express.static("conversions"));

app.get("/health", (req, res) => {
    res.json({status: "Available"});
});

app.get("/api/files", checkJwt, (req, res, next) => {
    const user = req.user.sub.split("|")[1];

    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR);
    }

    fs.readdir(`${UPLOAD_DIR}/${user}`, (err, files) => {
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

    res.download(`${UPLOAD_DIR}/${user}/${fileName}`, fileName, (err) => {
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

    renameUploadedFiles(user, files).then(async () => {
        console.log("Uploaded files to server: ", files.map(file => file.name));

        // upload to forge
        for (let file of files) {
            console.log("Uploading file to forge: ", file.name);

            uploadFileToForge(`${UPLOAD_DIR}/${user}/${file.name}`, file.name)
                .then(res => {
                    console.log(res.body);
                    unfinishedTranslations.push({urn: res.body.urn, name: file.name});
                })
                .catch(console.log);
        }

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

// forge API handlers
require("./forge-handler")(app, checkJwt);


const port = process.env.API_SERVER_PORT || 3001;

app.listen(port, () => console.log(`Conversion API listening on port ${port}`));

// scheduler to poll for finished translations
setInterval(async () => {

    // reverse iterate to preserve splicing index
    let i = unfinishedTranslations.length;
    while (i--) {
        try {
            const unfinishedTrans = unfinishedTranslations[i];
            await downloadForgeFile(unfinishedTrans.urn, unfinishedTrans.name);
            unfinishedTranslations.splice(i, 1);
        } catch (e) {
            console.log(e.message);
        }
    }
}, 10000);

function renameUploadedFiles(user, files) {
    return new Promise((resolve, reject) => {
        fs.access(`${UPLOAD_DIR}/${user}`, (error) => {
            if (error) {
                // Directory does not exist
                fs.mkdirSync(`${UPLOAD_DIR}/${user}`);
            }

            for (let file of files) {
                fs.rename(file.path, `${UPLOAD_DIR}/${user}/${file.originalFilename}`, function (err) {
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
