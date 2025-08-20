import { Request, Response } from 'express';

import { unlinkAsync } from '../util/functions';
import MessageQueueManager from '../services/messageQueueManager';

function returnError(req, res, error) {
  req.logger.error(error);
  res
    .status(500)
    .json({ status: 'Error', message: 'Erro ao enviar status.', error: error });
}

async function returnSucess(res, data) {
  res.status(201).json({ status: 'success', response: data, mapper: 'return' });
}

export async function sendTextStorie(req, res) {
  /**
     #swagger.tags = ["Status Stories"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["obj"] = {
      in: 'body',
      schema: {
        text: 'My new storie',
        options: { backgroundColor: '#0275d8', font: 2},
      }
     }
     #swagger.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              options: { type: 'object' },
            },
            required: ['text'],
          },
          examples: {
            'Default': {
              value: {
                text: 'My new storie',
                options: { backgroundColor: '#0275d8', font: 2},
              },
            },
          },
        },
      },
    }
   */
  const { text, options } = req.body;

  if (!text)
    res.status(401).send({
      message: 'Text was not informed',
    });

  try {
    const results: any = [];
    const queuedResults: any = [];

    // CRITICAL FIX: Process status messages through the queue system with 30-second delays
    const queueResult = await MessageQueueManager.processMessageRequest(
      req,
      'status@broadcast',
      text,
      options,
      async (phoneNumber: string, msg: string, opts: any) => {
        return await req.client.sendTextStatus(msg, opts);
      }
    );

    if (queueResult.success) {
      if (queueResult.queued) {
        queuedResults.push({
          phone: 'status@broadcast',
          status: 'queued',
          messageId: queueResult.messageId,
          estimatedSendTime: queueResult.estimatedSendTime,
          message: 'Status message queued for delivery with 30-second delay'
        });
      } else {
        results.push(queueResult.result);
      }
    } else {
      return res.status(400).json({
        status: 'Error',
        message: 'Error sending status message',
        error: queueResult.error
      });
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json('Error sending the text of stories');
    }

    res.status(201).json({
      status: 'success',
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length
      },
      mapper: 'return'
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendImageStorie(req, res) {
  /**
     #swagger.tags = ["Status Stories"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
            required: ['path'],
          },
          examples: {
            'Default': {
              value: {
                path: 'Path of your image',
              },
            },
          },
        },
      },
    }
   */
  const { path } = req.body;

  if (!path && !req.file)
    res.status(401).send({
      message: 'Sending the image is mandatory',
    });

  const pathFile = path || req.file?.path;

  try {
    const results: any = [];
    results.push(await req.client.sendImageStatus(pathFile));

    if (results.length === 0)
      res.status(400).json('Error sending the image of stories');
    returnSucess(res, results);
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendVideoStorie(req, res) {
  /**
     #swagger.tags = ["Status Stories"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              path: { type: "string" }
            },
            required: ["path"]
          },
          examples: {
            "Default": {
              value: {
                path: "Path of your video"
              }
            }
          }
        }
      }
    }
   */
  const { path } = req.body;

  if (!path && !req.file)
    res.status(401).send({
      message: 'Sending the Video is mandatory',
    });

  const pathFile = path || req.file?.path;

  try {
    const results: any = [];

    results.push(await req.client.sendVideoStatus(pathFile));

    if (results.length === 0) res.status(400).json('Error sending message');
    if (req.file) await unlinkAsync(pathFile);
    returnSucess(res, results);
  } catch (error) {
    returnError(req, res, error);
  }
}
