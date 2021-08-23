const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");
dotenv.config();
const UPLOAD_DIR = "uploads";
const CONVERSION_DIR = "conversions";

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const bodyParser = require("body-parser");
const multer = require('multer');

const multerStorage = multer.diskStorage({
                                       destination: function(req, file, cb) {
                                           cb(null, UPLOAD_DIR);
                                       },

                                       filename: function(req, file, cb) {
                                           cb(null, file.originalname);
                                       }
                                   });
const upload = multer({ storage: multerStorage });

const authConfig = process.env.NODE_ENV !== "production" ? require("./auth_config.json") : require("./auth_config.prod.json");
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

if (!fs.existsSync(CONVERSION_DIR)) {
    fs.mkdirSync(CONVERSION_DIR);
}

if (!authConfig.domain || !authConfig.audience || authConfig.audience === "YOUR_API_IDENTIFIER") {
    console.log(
        "Exiting: Please make sure that auth_config.json is in place and populated with valid domain and audience values"
    );

    process.exit();
} else if(!process.env.FORGE_CLIENT_ID){
    console.log(
        "Exiting: Please make sure that the forge config is present"
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

app.get("/files/download/:userID/:fileName", (req, res) => {
    const userID = req.params.userID;
    const fileName = req.params.fileName;

    res.download(`${UPLOAD_DIR}/${userID}/${fileName}`, fileName, (err) => {
        if (err) {
            res.status(500)
               .send({
                         message: "Could not download the file. " + err
                     });
        }
    });
});

app.post("/upload", checkJwt, upload.array('uploads[]'), (req, res) => {

    const user = req.user.sub.split("|")[1]; // remove auth0 from sub
    const files = req.files;

    renameUploadedFiles(user, files).then(async () => {
        console.log("Uploaded files to server: ", files.map(file => file.originalname));

        // upload to forge
        for (let file of files) {
            const fileName = file.originalname
            console.log("Uploading file to forge: ", fileName);

            uploadFileToForge(`${UPLOAD_DIR}/${user}/${fileName}`, fileName)
                .then(res => {
                    console.log(res.body.result);
                    console.log(res.body.acceptedJobs);
                    unfinishedTranslations.push({urn: res.body.urn, name: fileName});
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
                fs.rename(file.path, `${UPLOAD_DIR}/${user}/${file.originalname}`, function (err) {
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
