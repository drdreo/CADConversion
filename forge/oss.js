/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

const fs = require("fs");
const async = require("async");

const {BucketsApi, ObjectsApi, PostBucketsPayload} = require("forge-apis");

const {getClient, getInternalToken} = require("./oauth");
const config = require("./config");
const {generateGUID} = require("../utils");

// GET /api/forge/oss/buckets - expects a query param 'id'; if the param is '#' or empty,
// returns a JSON with list of buckets, otherwise returns a JSON with list of objects in bucket with given name.
async function getBuckets(bucketName) {
    console.log(`Getting buckets[${bucketName}]`);

    const client = getClient();
    const token = await getInternalToken();

    if (!bucketName || bucketName === "#") {
        try {
            // Retrieve up to 100 buckets from Forge using the [BucketsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/BucketsApi.md#getBuckets)
            // Note: if there's more buckets, you should call the getBucket method in a loop, providing different 'startAt' params
            const buckets = await new BucketsApi().getBuckets({limit: 100}, client, token);
            return buckets.body.items.map((bucket) => {
                return {
                    id: bucket.bucketKey,
                    // Remove bucket key prefix that was added during bucket creation
                    text: bucket.bucketKey.replace(config.credentials.client_id.toLowerCase() + "-", ""),
                    type: "bucket",
                    children: true
                };
            });
        } catch (err) {
            console.error(err);
        }
    } else {
        try {
            // Retrieve up to 100 objects from Forge using the [ObjectsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/ObjectsApi.md#getObjects)
            // Note: if there's more objects in the bucket, you should call the getObjects method in a loop, providing different 'startAt' params
            const objects = await new ObjectsApi().getObjects(bucketName, {limit: 100}, client, token);

            return objects.body.items.map((object) => {
                return {
                    id: Buffer.from(object.objectId).toString("base64"),
                    text: object.objectKey,
                    type: "object",
                    children: false
                };
            });
        } catch (err) {
            console.error(err);
        }
    }
}


// POST /api/forge/oss/buckets - creates a new bucket.
async function createBucket(bucketName) {
    bucketName = bucketName.toLowerCase();
    console.log(`Creating bucket[${bucketName}]`);

    const client = getClient();
    const token = await getInternalToken();

    let payload = new PostBucketsPayload();
    payload.bucketKey = config.credentials.client_id.toLowerCase() + "-" + bucketName;
    payload.policyKey = "transient"; // expires in 24h

    // Create a bucket using [BucketsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/BucketsApi.md#createBucket).
    return new BucketsApi().createBucket(payload, {}, client, token);
}

async function existOrCreateBucket(bucketKey) {
    console.log(`Check if bucket{${bucketKey}} exists...`);

    const client = getClient();
    const token = await getInternalToken();
    const ossBuckets = new BucketsApi();

    return (ossBuckets.getBucketDetails(bucketKey, client, token)
                      .then(function (results) {
                          return (results);
                      })
                      .catch(function () {
                          console.log("Create Bucket...");
                          const opts = {
                              bucketKey: bucketKey,
                              policyKey: "persistent"
                          };
                          const headers = {
                              xAdsRegion: "US"
                          };
                          return (ossBuckets.createBucket(opts, headers, client, token));
                      })
    );
}

// POST /api/forge/oss/objects - uploads new object to given bucket.
async function uploadFile(filePath, originalName, bucketKey) {
    console.log(`Uploading file[${originalName}] to bucket[${bucketKey}]`);

    const client = getClient();
    const token = await getInternalToken();

    return new Promise(async (resolve, reject) => {
        console.log("reading file: ", filePath);

        fs.readFile(filePath, async (err, data) => {
            if (err) {
                throw err;
            }
            try {
                // Upload an object to bucket using [ObjectsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/ObjectsApi.md#uploadObject).
                const response = await new ObjectsApi().uploadObject(bucketKey, originalName, data.length, data, {}, client, token);
                resolve(response);
            } catch (err) {
                reject(err);
            }
        });
    });
}


/////////////////////////////////////////////////////////
// Uploads object to bucket using resumable endpoint
//
/////////////////////////////////////////////////////////
async function uploadFileChunked(filePath, originalName, bucketKey, opts = {}) {
    console.log(`Uploading chunked file[${originalName}] to bucket[${bucketKey}]`);

    const token = await getInternalToken();
    // const client = getClient();
    const {size: fileSize} = fs.statSync(filePath);

    return new Promise((resolve, reject) => {

        const chunkSize = 5 * 1024 * 1024;
        const nbChunks = Math.ceil(fileSize / chunkSize);
        const chunksMap = Array.from({length: nbChunks}, (e, i) => i);
        console.log(`Detected ${nbChunks} chunks. Total size: ${Math.round(fileSize / 1024)}KB`);

        // generates uniques session ID
        const sessionId = generateGUID();

        // prepare the upload tasks
        const uploadTasks = chunksMap.map((chunkIdx) => {

            const start = chunkIdx * chunkSize;
            const end = Math.min(fileSize, (chunkIdx + 1) * chunkSize) - 1;
            const range = `bytes ${start}-${end}/${fileSize}`;
            const length = end - start + 1;
            const readStream = fs.createReadStream(filePath, {start, end});

            const run = async () => {
                return new ObjectsApi().uploadChunk(
                    bucketKey, originalName,
                    length, range, sessionId,
                    readStream, {},
                    {autoRefresh: false}, token);
            };

            return {
                chunkIndex: chunkIdx,
                run
            };
        });

        let progress = 0;

        // runs asynchronously in parallel the upload tasks
        // number of simultaneous uploads is defined by
        // opts.concurrentUploads
        async.eachLimit(uploadTasks, opts.concurrentUploads || 3, (task, callback) => {

            task.run().then((res) => {
                if (opts.onProgress) {

                    progress += 100.0 / nbChunks;

                    opts.onProgress({
                                        sessionId,
                                        progress: Math.round(progress * 100) / 100,
                                        chunkIndex: task.chunkIndex
                                    });
                }
                if (res.body) {
                    callback({body: res.body});
                } else {
                    callback();
                }
            }, (error) => {
                console.log(error);
                callback({error});
            });

        }, (response) => {
            console.log("Finished uploading all chunks.");

            if (response.error) {
                return reject(response.error);
            }
            if (!response.body) {
                return resolve({fileSize, bucketKey, originalName, nbChunks});
            }
            console.log(response.body);

            return resolve({fileSize, bucketKey, objectId: response.body.objectId, originalName, nbChunks});
        });
    });
}

async function downloadFile(originalName, bucketKey) {
    console.log(`Downloading file[${originalName}] from bucket[${bucketKey}]`);

    const client = getClient();
    const token = await getInternalToken();

    return new Promise(async (resolve, reject) => {

        try {
            // Upload an object to bucket using [ObjectsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/ObjectsApi.md#uploadObject).
            const response = await new ObjectsApi().getObject(bucketKey, originalName, {}, client, token);
            resolve(response);
        } catch (err) {
            reject(err);
        }

    });
}

module.exports = {
    getBuckets,
    createBucket,
    existOrCreateBucket,
    uploadFile,
    uploadFileChunked,
    downloadFile
};
