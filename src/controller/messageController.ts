/*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Request, Response } from 'express';

import MessageQueueManager from '../services/messageQueueManager';
import { unlinkAsync } from '../util/functions';

function returnError(req: Request, res: Response, error: any) {
  req.logger.error(error);

  // Check if response has already been sent to avoid header errors
  if (res.headersSent) {
    req.logger.warn('Response already sent, cannot send error response');
    return;
  }

  res.status(500).json({
    status: 'Error',
    message: 'Erro ao enviar a mensagem.',
    error: error,
  });
}

async function returnSucess(res: any, data: any) {
  // CRITICAL FIX: Check if response has already been sent to avoid header errors
  if (res.headersSent) {
    console.warn('Response already sent, cannot send success response');
    return;
  }
  res.status(201).json({ status: 'success', response: data, mapper: 'return' });
}

export async function sendMessage(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
    #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              phone: { type: "string" },
              isGroup: { type: "boolean" },
              isNewsletter: { type: "boolean" },
              isLid: { type: "boolean" },
              message: { type: "string" },
              options: { type: "object" },
            }
          },
          examples: {
            "Send message to contact": {
              value: { 
                phone: '5521999999999',
                isGroup: false,
                isNewsletter: false,
                isLid: false,
                message: 'Hi from WPPConnect',
              }
            },
            "Send message with reply": {
              value: { 
                phone: '5521999999999',
                isGroup: false,
                isNewsletter: false,
                isLid: false,
                message: 'Hi from WPPConnect with reply',
                options: {
                  quotedMsg: 'true_...@c.us_3EB01DE65ACC6_out',
                }
              }
            },
            "Send message to group": {
              value: {
                phone: '8865623215244578',
                isGroup: true,
                message: 'Hi from WPPConnect',
              }
            },
          }
        }
      }
     }
   */
  const { phone, message } = req.body;

  const options = req.body.options || {};

  try {
    // Check if client exists before attempting to send messages
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        message,
        options,
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendText(phoneNumber, msg, opts);
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('mensagem-enviada', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('mensagem-enfileirada', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function editMessage(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
    #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string" },
              newText: { type: "string" },
              options: { type: "object" },
            }
          },
          examples: {
            "Edit a message": {
              value: { 
                id: 'true_5521999999999@c.us_3EB04FCAA1527EB6D9DEC8',
                newText: 'New text for message'
              }
            },
          }
        }
      }
     }
   */
  const { id, newText } = req.body;

  const options = req.body.options || {};
  try {
    const edited = await (req.client as any).editMessage(id, newText, options);

    req.io.emit('edited-message', edited);
    returnSucess(res, edited);
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendFile(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
            schema: {
                type: "object",
                properties: {
                    "phone": { type: "string" },
                    "isGroup": { type: "boolean" },
                    "isNewsletter": { type: "boolean" },
                    "isLid": { type: "boolean" },
                    "filename": { type: "string" },
                    "caption": { type: "string" },
                    "base64": { type: "string" }
                }
            },
            examples: {
                "Default": {
                    value: {
                        "phone": "5521999999999",
                        "isGroup": false,
                        "isNewsletter": false,
                        "isLid": false,
                        "filename": "file name lol",
                        "caption": "caption for my file",
                        "base64": "<base64> string"
                    }
                }
            }
        }
      }
    }
   */
  const {
    phone,
    path,
    base64,
    filename = 'file',
    message,
    caption,
    quotedMessageId,
  } = req.body;

  const options = req.body.options || {};

  if (!path && !req.file && !base64)
    res.status(401).send({
      message: 'Sending the file is mandatory',
    });

  const pathFile = path || base64 || req.file?.path;
  const msg = message || caption;

  try {
    // Check if client exists before attempting to send files
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contact of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contact,
        msg || 'File attachment',
        { filename, pathFile, quotedMsg: quotedMessageId, ...options },
        async (phoneNumber: string, message: string, opts: any) => {
          return await req.client.sendFile(phoneNumber, opts.pathFile, {
            filename: opts.filename,
            caption: message,
            quotedMsg: opts.quotedMsg,
            ...opts,
          });
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contact,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `File queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contact,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No files were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('file-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('file-queued', queuedResults);
    }

    // Clean up uploaded file
    if (req.file) await unlinkAsync(pathFile);

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendVoice(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
        required: true,
        "@content": {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        "phone": { type: "string" },
                        "isGroup": { type: "boolean" },
                        "path": { type: "string" },
                        "quotedMessageId": { type: "string" }
                    }
                },
                examples: {
                    "Default": {
                        value: {
                            "phone": "5521999999999",
                            "isGroup": false,
                            "path": "<path_file>",
                            "quotedMessageId": "message Id"
                        }
                    }
                }
            }
        }
    }
   */
  const {
    phone,
    path,
    filename = 'Voice Audio',
    message,
    quotedMessageId,
  } = req.body;

  try {
    // Check if client exists before attempting to send voice
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        message || 'Voice message',
        { path, filename, quotedMessageId },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendPtt(
            phoneNumber,
            opts.path,
            opts.filename,
            msg,
            opts.quotedMessageId
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Voice message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No voice messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('voice-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('voice-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendVoice64(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
        required: true,
        "@content": {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        "phone": { type: "string" },
                        "isGroup": { type: "boolean" },
                        "base64Ptt": { type: "string" }
                    }
                },
                examples: {
                    "Default": {
                        value: {
                            "phone": "5521999999999",
                            "isGroup": false,
                            "base64Ptt": "<base64_string>"
                        }
                    }
                }
            }
        }
    }
   */
  const { phone, base64Ptt, quotedMessageId } = req.body;

  try {
    // Check if client exists before attempting to send voice64
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        'Voice message (base64)',
        { base64Ptt, quotedMessageId },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendPttFromBase64(
            phoneNumber,
            opts.base64Ptt,
            'Voice Audio',
            '',
            opts.quotedMessageId
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Voice64 message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No voice64 messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('voice64-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('voice64-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendLinkPreview(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
        required: true,
        "@content": {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        "phone": { type: "string" },
                        "isGroup": { type: "boolean" },
                        "url": { type: "string" },
                        "caption": { type: "string" }
                    }
                },
                examples: {
                    "Default": {
                        value: {
                            "phone": "5521999999999",
                            "isGroup": false,
                            "url": "http://www.link.com",
                            "caption": "Text for describe link"
                        }
                    }
                }
            }
        }
    }
   */
  const { phone, url, caption } = req.body;

  try {
    // Check if client exists before attempting to send link preview
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        caption || `Link: ${url}`,
        { url, caption },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendLinkPreview(
            `${phoneNumber}`,
            opts.url,
            opts.caption
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Link preview queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No link previews were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('link-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('link-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendLocation(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
        required: true,
        "@content": {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        "phone": { type: "string" },
                        "isGroup": { type: "boolean" },
                        "lat": { type: "string" },
                        "lng": { type: "string" },
                        "title": { type: "string" },
                        "address": { type: "string" }
                    }
                },
                examples: {
                    "Default": {
                        value: {
                            "phone": "5521999999999",
                            "isGroup": false,
                            "lat": "-89898322",
                            "lng": "-545454",
                            "title": "Rio de Janeiro",
                            "address": "Av. N. S. de Copacabana, 25, Copacabana"
                        }
                    }
                }
            }
        }
    }
   */
  const { phone, lat, lng, title, address } = req.body;

  try {
    // Check if client exists before attempting to send location
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        `Location: ${title}`,
        { lat, lng, address, name: title },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendLocation(phoneNumber, {
            lat: opts.lat,
            lng: opts.lng,
            address: opts.address,
            name: opts.name,
          });
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Location queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No locations were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('location-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('location-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendButtons(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA',
     }
     #swagger.deprecated=true
   */
  const { phone, message, options } = req.body;

  try {
    // Check if client exists before attempting to send buttons
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contact of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contact,
        message,
        options || {},
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendText(phoneNumber, msg, opts);
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contact,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Button message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contact,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No button messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('buttons-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('buttons-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendListMessage(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA',
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              phone: { type: "string" },
              isGroup: { type: "boolean" },
              description: { type: "string" },
              sections: { type: "array" },
              buttonText: { type: "string" },
            }
          },
          examples: {
            "Send list message": {
              value: { 
                phone: '5521999999999',
                isGroup: false,
                description: 'Desc for list',
                buttonText: 'Select a option',
                sections: [
                  {
                    title: 'Section 1',
                    rows: [
                      {
                        rowId: 'my_custom_id',
                        title: 'Test 1',
                        description: 'Description 1',
                      },
                      {
                        rowId: '2',
                        title: 'Test 2',
                        description: 'Description 2',
                      },
                    ],
                  },
                ],
              }
            },
          }
        }
      }
     }
   */
  const {
    phone,
    description = '',
    sections,
    buttonText = 'SELECIONE UMA OPÇÃO',
  } = req.body;

  try {
    // Check if client exists before attempting to send list message
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contact of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contact,
        description || 'List message',
        { buttonText, description, sections },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendListMessage(phoneNumber, {
            buttonText: opts.buttonText,
            description: opts.description,
            sections: opts.sections,
          });
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contact,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `List message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contact,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No list messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('list-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('list-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendOrderMessage(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
    #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              phone: { type: "string" },
              isGroup: { type: "boolean" },
              items: { type: "object" },
              options: { type: "object" },
            }
          },
          examples: {
            "Send with custom items": {
              value: { 
                phone: '5521999999999',
                isGroup: false,
                items: [
                  {
                    type: 'custom',
                    name: 'Item test',
                    price: 120000,
                    qnt: 2,
                  },
                  {
                    type: 'custom',
                    name: 'Item test 2',
                    price: 145000,
                    qnt: 2,
                  },
                ],
              }
            },
            "Send with product items": {
              value: { 
                phone: '5521999999999',
                isGroup: false,
                items: [
                  {
                    type: 'product',
                    id: '37878774457',
                    price: 148000,
                    qnt: 2,
                  },
                ],
              }
            },
            "Send with custom items and options": {
              value: { 
                phone: '5521999999999',
                isGroup: false,
                items: [
                  {
                    type: 'custom',
                    name: 'Item test',
                    price: 120000,
                    qnt: 2,
                  },
                ],
                options: {
                  tax: 10000,
                  shipping: 4000,
                  discount: 10000,
                }
              }
            },
          }
        }
      }
     }
   */
  const { phone, items } = req.body;

  const options = req.body.options || {};

  try {
    const results: any = [];
    const queuedResults: any = [];

    // CRITICAL FIX: Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        `Order: ${items.length} items`,
        { items, options },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendOrderMessage(
            phoneNumber,
            opts.items,
            opts.options
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Order message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No order messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('mensagem-enviada', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('mensagem-enfileirada', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendPollMessage(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
    #swagger.requestBody = {
        required: true,
        "@content": {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        phone: { type: "string" },
                        isGroup: { type: "boolean" },
                        name: { type: "string" },
                        choices: { type: "array" },
                        options: { type: "object" },
                    }
                },
                examples: {
                    "Default": {
                        value: {
                          phone: '5521999999999',
                          isGroup: false,
                          name: 'Poll name',
                          choices: ['Option 1', 'Option 2', 'Option 3'],
                          options: {
                            selectableCount: 1,
                          }
                        }
                    },
                }
            }
        }
    }
   */
  const { phone, name, choices, options } = req.body;

  try {
    const results: any = [];

    for (const contact of phone) {
      results.push(
        await req.client.sendPollMessage(contact, name, choices, options)
      );
    }

    if (results.length === 0)
      return returnError(req, res, 'Error sending poll message');

    returnSucess(res, results);
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendStatusText(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
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
              phone: { type: 'string' },
              isGroup: { type: 'boolean' },
              message: { type: 'string' },
              messageId: { type: 'string' }
            },
            required: ['phone', 'isGroup', 'message']
          },
          examples: {
            Default: {
              value: {
                phone: '5521999999999',
                isGroup: false,
                message: 'Reply to message',
                messageId: '<id_message>'
              }
            }
          }
        }
      }
    }
   */
  const { message } = req.body;

  try {
    // Check if client exists before attempting to send status text
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process status message with queue system (single recipient: status@broadcast)
    const queueResult = await MessageQueueManager.processMessageRequest(
      req,
      'status@broadcast',
      message,
      {},
      async (phoneNumber: string, msg: string, _opts: any) => {
        return await req.client.sendText(phoneNumber, msg);
      }
    );

    if (queueResult.success) {
      if (queueResult.queued) {
        queuedResults.push({
          phone: 'status@broadcast',
          status: 'queued',
          messageId: queueResult.messageId,
          estimatedSendTime: queueResult.estimatedSendTime,
          message: `Status message queued for delivery with 30-second delay`,
        });
      } else {
        results.push(queueResult.result);
      }
    } else {
      results.push({
        phone: 'status@broadcast',
        status: 'error',
        error: queueResult.error,
      });
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'Status message was not processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('status-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('status-queued', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function replyMessage(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              "phone": { type: "string" },
              "isGroup": { type: "boolean" },
              "message": { type: "string" },
              "messageId": { type: "string" }
            }
          },
          examples: {
            "Default": {
              value: {
                "phone": "5521999999999",
                "isGroup": false,
                "message": "Reply to message",
                "messageId": "<id_message>"
              }
            }
          }
        }
      }
    }
   */
  const { phone, message, messageId } = req.body;

  try {
    const results: any = [];
    const queuedResults: any = [];

    // CRITICAL FIX: Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        `Reply: ${message}`,
        { message, messageId },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.reply(
            phoneNumber,
            opts.message,
            opts.messageId
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Reply message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No reply messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('mensagem-enviada', { message: message, to: phone });
    }
    if (queuedResults.length > 0) {
      req.io.emit('mensagem-enfileirada', queuedResults);
    }

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function sendMentioned(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
  required: true,
  "@content": {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          "phone": { type: "string" },
          "isGroup": { type: "boolean" },
          "message": { type: "string" },
          "mentioned": { type: "array", items: { type: "string" } }
        },
        required: ["phone", "message", "mentioned"]
      },
      examples: {
        "Default": {
          value: {
            "phone": "groupId@g.us",
            "isGroup": true,
            "message": "Your text message",
            "mentioned": ["556593077171@c.us"]
          }
        }
      }
    }
  }
}
   */
  const { phone, message, mentioned } = req.body;

  try {
    // Check if client exists before attempting to send mentioned message
    if (!req.client) {
      return res.status(400).json({
        status: 'Error',
        message: 'WhatsApp session not connected. Please scan QR code first.',
        error: 'Session client not available',
      });
    }

    const results: any = [];
    const queuedResults: any = [];

    // Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        message,
        { mentioned },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendMentioned(
            `${phoneNumber}`,
            msg,
            opts.mentioned
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Mentioned message queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      return res.status(400).json({
        status: 'Error',
        message: 'No mentioned messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('mentioned-sent', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('mentioned-queued', queuedResults);
    }

    res.status(201).json({
      status: 'success',
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    req.logger.error(error);
    res.status(500).json({
      status: 'error',
      message: 'Error on send message mentioned',
      error: error,
    });
  }
}
export async function sendImageAsSticker(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
     #swagger.autoBody=false
     #swagger.security = [{
            "bearerAuth": []
     }]
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              "phone": { type: "string" },
              "isGroup": { type: "boolean" },
              "path": { type: "string" }
            },
            required: ["phone", "path"]
          },
          examples: {
            "Default": {
              value: {
                "phone": "5521999999999",
                "isGroup": true,
                "path": "<path_file>"
              }
            }
          }
        }
      }
    }
   */
  const { phone, path } = req.body;

  if (!path && !req.file)
    res.status(401).send({
      message: 'Sending the file is mandatory',
    });

  const pathFile = path || req.file?.path;

  try {
    const results: any = [];
    const queuedResults: any = [];

    // CRITICAL FIX: Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        'Image as sticker',
        { pathFile },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendImageAsSticker(
            phoneNumber,
            opts.pathFile
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Image sticker queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      if (req.file) await unlinkAsync(pathFile);
      return res.status(400).json({
        status: 'Error',
        message: 'No sticker messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('mensagem-enviada', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('mensagem-enfileirada', queuedResults);
    }

    // Clean up file after all processing
    if (req.file) await unlinkAsync(pathFile);

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}
export async function sendImageAsStickerGif(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Messages"]
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
              phone: { type: 'string' },
              isGroup: { type: 'boolean' },
              path: { type: 'string' },
            },
            required: ['phone', 'path'],
          },
          examples: {
            'Default': {
              value: {
                phone: '5521999999999',
                isGroup: true,
                path: '<path_file>',
              },
            },
          },
        },
      },
    }
   */
  const { phone, path } = req.body;

  if (!path && !req.file)
    res.status(401).send({
      message: 'Sending the file is mandatory',
    });

  const pathFile = path || req.file?.path;

  try {
    const results: any = [];
    const queuedResults: any = [];

    // CRITICAL FIX: Process each phone number with message queue system
    for (const contato of phone) {
      const queueResult = await MessageQueueManager.processMessageRequest(
        req,
        contato,
        'Animated sticker',
        { pathFile },
        async (phoneNumber: string, msg: string, opts: any) => {
          return await req.client.sendImageAsStickerGif(
            phoneNumber,
            opts.pathFile
          );
        }
      );

      if (queueResult.success) {
        if (queueResult.queued) {
          queuedResults.push({
            phone: contato,
            status: 'queued',
            messageId: queueResult.messageId,
            estimatedSendTime: queueResult.estimatedSendTime,
            message: `Animated sticker queued for delivery with 30-second delay`,
          });
        } else {
          results.push(queueResult.result);
        }
      } else {
        results.push({
          phone: contato,
          status: 'error',
          error: queueResult.error,
        });
      }
    }

    // Combine immediate and queued results
    const allResults = [...results, ...queuedResults];

    if (allResults.length === 0) {
      if (req.file) await unlinkAsync(pathFile);
      return res.status(400).json({
        status: 'Error',
        message: 'No animated sticker messages were processed',
        error: 'Empty results',
      });
    }

    // Emit socket events for both immediate and queued messages
    if (results.length > 0) {
      req.io.emit('mensagem-enviada', results);
    }
    if (queuedResults.length > 0) {
      req.io.emit('mensagem-enfileirada', queuedResults);
    }

    // Clean up file after all processing
    if (req.file) await unlinkAsync(pathFile);

    returnSucess(res, {
      immediate: results,
      queued: queuedResults,
      summary: {
        total: allResults.length,
        immediate: results.length,
        queued: queuedResults.length,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}
