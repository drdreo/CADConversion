const fs = require("fs");

const dotenv = require("dotenv");
dotenv.config();
const UPLOAD_DIR = "uploads";
const CONVERSION_DIR = "conversions";
const TRANSLATION_POLLING_INTERVAL = 30000;

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const bodyParser = require("body-parser");
const multer = require("multer");

const multerStorage = multer.diskStorage({
                                             destination: function (req, file, cb) {
                                                 cb(null, UPLOAD_DIR);
                                             },

                                             filename: function (req, file, cb) {
                                                 cb(null, file.originalname);
                                             }
                                         });
const upload = multer({storage: multerStorage});

const authConfig = process.env.NODE_ENV !== "production" ? require("./auth_config.json") : require("./auth_config.prod.json");
const {uploadFileToForge, downloadForgeFile} = require("./forge/forge-helper");

const app = express();
const unfinishedTranslations = [];
// const unfinishedTranslations = [
//     {
//         urn: "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dGhpZWxlLWNvbnZlcnNpb24vQnVlY2hlbF9SZXZfSy5zdHA",
//         user: "114662313698141434676",
//         started: Date.now(),
//         downloading: false,
//         fileName: "Buechel_Rev_K.stp"
//     }
// ];


function requestLogger(httpModule) {
    const original = httpModule.request;
    httpModule.request = function (options, callback) {
        console.log(options.method, options.href || options.proto + "://" + options.host + options.path);
        return original(options, callback);
    };
}

requestLogger(require("http"));
requestLogger(require("https"));

if (!fs.existsSync(CONVERSION_DIR)) {
    fs.mkdirSync(CONVERSION_DIR);
}

if (!authConfig.domain || !authConfig.audience || authConfig.audience === "YOUR_API_IDENTIFIER") {
    console.log("Exiting: Please make sure that auth_config.json is in place and populated with valid domain and audience values");
    process.exit();
} else if (!process.env.FORGE_CLIENT_ID) {
    console.log("Exiting: Please make sure that the forge config is present");
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

app.use("/conversions", express.static(CONVERSION_DIR));

app.get("/health", (req, res) => {
    res.json({status: "Available"});
});

app.get("/files", checkJwt, (req, res) => {
    const user = req.user.sub.split("|")[1];

    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR);
    }

    fs.readdir(`${UPLOAD_DIR}/${user}`, (err, files) => {
        if (err) {
            res.send({files: []});
        } else {
            files = files.map(file => {
                return {name: file};
            });
            res.send({files});
        }
    });
});

// app.get("/conversions/:user", checkJwt, (req, res) => {
//     const user = req.params.user;
//
//     fs.readdir(`${CONVERSION_DIR}/${user}`, (err, files) => {
//         if (err) {
//             res.send({convertedFiles: []});
//         } else {
//             files = files.map(file => {
//                 return {name: file};
//             });
//             res.send({convertedFiles: files});
//         }
//     });
// });

app.get("/files/download/:userID/:fileName", (req, res) => {
    const userID = req.params.userID;
    const fileName = req.params.fileName;

    res.download(`${CONVERSION_DIR}/${userID}/${fileName}`, fileName, (err) => {
        if (err) {
            res.status(500)
               .send({
                         message: "Could not download the file. " + err
                     });
        }
    });
});

app.post("/upload", checkJwt, upload.array("uploads[]"), (req, res) => {

    const user = req.user.sub.split("|")[1]; // remove auth0 from sub
    const files = req.files;

    renameUploadedFiles(user, files).then(async () => {
        console.log("Uploaded files to server: ", files.map(file => file.originalname));

        // upload to forge
        for (let file of files) {
            const fileName = file.originalname;

            uploadFileToForge(`${UPLOAD_DIR}/${user}/${fileName}`, fileName)
                .then(res => {
                    console.log("uploadFileToForge result:" + res.body.result);
                    unfinishedTranslations.push({
                                                    user,
                                                    urn: res.body.urn,
                                                    fileName,
                                                    downloading: false,
                                                    started: Date.now()
                                                });
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

app.listen(port, () => console.log(`Conversion API[${process.env.NODE_ENV}] listening on port ${port}`));


// scheduler to poll for finished translations
setInterval(async () => {

    // reverse iterate to preserve splicing index
    let i = unfinishedTranslations.length;
    while (i--) {
        try {
            const {user, urn, fileName} = unfinishedTranslations[i];
            await downloadForgeFile(user, urn, fileName, unfinishedTranslations[i]);
            console.log("Translation finished after " + Date.now() - unfinishedTranslations[i].started);
            unfinishedTranslations.splice(i, 1);
        } catch (e) {
            console.log(e.message);
        }
    }
}, TRANSLATION_POLLING_INTERVAL);


function renameUploadedFiles(user, files) {
    return new Promise((resolve, reject) => {
        fs.access(`${UPLOAD_DIR}/${user}`, (error) => {
            if (error) {
                // Directory does not exist
                console.log("Directory not found. Creating it now.");
                fs.mkdirSync(`${UPLOAD_DIR}/${user}`);
            }

            for (let file of files) {
                fs.rename(file.path, `${UPLOAD_DIR}/${user}/${file.originalname}`, function (err) {
                    if (err) {
                        console.log("ERROR: " + err);
                        return reject(err);
                    }
                });
            }
            return resolve();
        });
    });
}
