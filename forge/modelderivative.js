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

const {
    DerivativesApi,
    JobPayload,
    JobPayloadInput,
    JobPayloadOutput,
    JobStepOutputPayload
} = require("forge-apis");

const {getClient, getInternalToken} = require("./oauth");


// Middleware for obtaining a token for each request.
// router.use(async (req, res, next) => {
//     const token = await getInternalToken();
//     req.oauth_token = token;
//     req.oauth_client = getClient();
//     next();
// });

// POST /api/forge/modelderivative/jobs - submits a new translation job for given object URN.
// Request body must be a valid JSON in the form of { "objectName": "<translated-object-urn>" }.
async function translateJob(urn) {
    console.log(`Translating urn[${urn}]`);

    const client = getClient();
    const token = await getInternalToken();

    let job = new JobPayload();
    job.input = new JobPayloadInput();
    job.input.urn = urn;
    job.output = new JobPayloadOutput([
                                          new JobStepOutputPayload()
                                      ]);
    job.output.formats[0].type = "obj";
    job.output.formats[0].views = ["2d", "3d"];

    // Submit a translation job using [DerivativesApi](https://github.com/Autodesk-Forge/forge-api-nodejs-client/blob/master/docs/DerivativesApi.md#translate).
    return new DerivativesApi().translate(job, {xAdsForce: true}, client, token);
}


async function getManifest(urn) {
    console.log(`Getting manifest urn[${urn}]`);

    const client = getClient();
    const token = await getInternalToken();

    return new DerivativesApi().getManifest(urn, {}, client, token);
}

async function downloadTranslatedFile(urn, derivativeUrn) {
    console.log(`Downloading urn[${urn}]`);
    console.log(`derivativeUrn[${derivativeUrn}]`);

    const client = getClient();
    const token = await getInternalToken();

    return new DerivativesApi().getDerivativeManifest(urn, derivativeUrn, {}, client, token);
}

module.exports = {
    translateJob,
    getManifest,
    downloadTranslatedFile
};
