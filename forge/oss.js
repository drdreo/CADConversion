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

const fs = require('fs');
const {BucketsApi, ObjectsApi, PostBucketsPayload} = require('forge-apis');

const {getClient, getInternalToken} = require('./oauth');
const config = require('./config');

// GET /api/forge/oss/buckets - expects a query param 'id'; if the param is '#' or empty,
// returns a JSON with list of buckets, otherwise returns a JSON with list of objects in bucket with given name.
async function getBuckets(bucketName) {
    console.log(`Getting buckets[${bucketName}]`);

    const client = getClient();
    const token = await getInternalToken();

    if (!bucketName || bucketName === '#') {
        try {
            // Retrieve up to 100 buckets from Forge using the [BucketsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/BucketsApi.md#getBuckets)
            // Note: if there's more buckets, you should call the getBucket method in a loop, providing different 'startAt' params
            const buckets = await new BucketsApi().getBuckets({limit: 100}, client, token);
            return buckets.body.items.map((bucket) => {
                return {
                    id: bucket.bucketKey,
                    // Remove bucket key prefix that was added during bucket creation
                    text: bucket.bucketKey.replace(config.credentials.client_id.toLowerCase() + '-', ''),
                    type: 'bucket',
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
                    id: Buffer.from(object.objectId).toString('base64'),
                    text: object.objectKey,
                    type: 'object',
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
    payload.bucketKey = config.credentials.client_id.toLowerCase() + '-' + bucketName;
    payload.policyKey = 'transient'; // expires in 24h

    // Create a bucket using [BucketsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/BucketsApi.md#createBucket).
    return new BucketsApi().createBucket(payload, {}, client, token);
}

async function existOrCreateBucket(bucketKey) {
    console.log('Check Bucket if bucket exists...');

    const client = getClient();
    const token = await getInternalToken();

    const ossBuckets = new BucketsApi();
    return (ossBuckets.getBucketDetails(bucketKey, client, token)
                      .then(function (results) {
                          return (results);
                      })
                      .catch(function (error) {
                          console.log('Create Bucket...');
                          const opts = {
                              bucketKey: bucketKey,
                              policyKey: 'persistent'
                          };
                          const headers = {
                              xAdsRegion: 'US'
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
        console.log('reading file: ', filePath);


        let chunkResponses = [];
        const readStream = fs.createReadStream(filePath, {highWaterMark: 5 * 1024, encoding: 'utf8'});

        // https://stackoverflow.com/questions/42662227/autodesk-forge-and-416-requested-range-not-satisfiable
        readStream.on('data', async function (chunk) {
            try {
                const res = await new ObjectsApi().uploadChunk(bucketKey, originalName, chunk.length, 5 * 1024, 1, chunk, {}, client, token);
                console.log(res);
                chunkResponses.push(res);
            } catch (err) {
                reject(err);
            }
        }).on('end', function () {
            console.log('read stream ended');
            console.log(chunkResponses);
            resolve(chunkResponses.pop());
        }).on('error', function (err) {
            reject(err);
        });

        // fs.readFile(filePath, async (err, data) => {
        //     if (err) {
        //         throw err;
        //     }
        //     try {
        //         // Upload an object to bucket using [ObjectsApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/ObjectsApi.md#uploadObject).
        //         const response = await new ObjectsApi().uploadObject(bucketKey, originalName, data.length, data, {}, client, token);
        //         resolve(response);
        //     } catch (err) {
        //         reject(err);
        //     }
        // });
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
    downloadFile
};
