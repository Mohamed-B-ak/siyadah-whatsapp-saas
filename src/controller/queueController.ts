import { Request, Response } from 'express';

import MessageQueueManager from '../services/messageQueueManager';

function returnSucess(res: Response, data: any) {
  res.status(200).json({
    status: 'success',
    response: data,
  });
}

function returnError(req: Request, res: Response, error: any) {
  req.logger?.error(error);

  if (res.headersSent) {
    req.logger?.warn('Response already sent, cannot send error response');
    return;
  }

  res.status(500).json({
    status: 'error',
    message: error.message || 'Internal server error',
    error: error,
  });
}

export async function getQueueStatus(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Message Queue"]
   * #swagger.description = "Get message queue status for a session"
   * #swagger.security = [{
   *   "bearerAuth": []
   * }]
   * #swagger.parameters["session"] = {
   *   schema: 'NERDWHATS_AMERICA'
   * }
   */

  try {
    const session = req.params.session;
    if (!session) {
      return res.status(400).json({
        status: 'error',
        message: 'Session parameter is required',
      });
    }

    const queueStatus = await MessageQueueManager.getQueueStatus(session);

    if (!queueStatus) {
      return returnSucess(res, {
        sessionId: session,
        queueExists: false,
        message: 'No message queue found for this session',
      });
    }

    returnSucess(res, {
      sessionId: session,
      queueExists: true,
      ...queueStatus,
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function clearQueue(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Message Queue"]
   * #swagger.description = "Clear all queued messages for a session"
   * #swagger.security = [{
   *   "bearerAuth": []
   * }]
   * #swagger.parameters["session"] = {
   *   schema: 'NERDWHATS_AMERICA'
   * }
   */

  try {
    const session = req.params.session;
    if (!session) {
      return res.status(400).json({
        status: 'error',
        message: 'Session parameter is required',
      });
    }

    const cleared = await MessageQueueManager.clearQueue(session);

    if (cleared) {
      req.logger?.info(`📬 Queue cleared for session: ${session}`);
      returnSucess(res, {
        sessionId: session,
        cleared: true,
        message: 'Queue cleared successfully',
      });
    } else {
      returnSucess(res, {
        sessionId: session,
        cleared: false,
        message: 'No queue found to clear',
      });
    }
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function getAllQueues(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Message Queue"]
   * #swagger.description = "Get status of all message queues (admin only)"
   * #swagger.security = [{
   *   "bearerAuth": []
   * }]
   */

  try {
    // This would need to be implemented in the MessageQueueService
    // For now, return a placeholder response
    returnSucess(res, {
      message: 'Queue overview endpoint - to be implemented',
      note: 'Use individual session endpoints for now',
    });
  } catch (error) {
    returnError(req, res, error);
  }
}

export async function getQueueStats(req: Request, res: Response) {
  /**
   * #swagger.tags = ["Message Queue"]
   * #swagger.description = "Get message queue statistics"
   * #swagger.security = [{
   *   "bearerAuth": []
   * }]
   */

  try {
    const session = req.params.session;
    if (!session) {
      return res.status(400).json({
        status: 'error',
        message: 'Session parameter is required',
      });
    }

    const queueStatus = await MessageQueueManager.getQueueStatus(session);

    if (!queueStatus) {
      return returnSucess(res, {
        sessionId: session,
        stats: {
          totalProcessed: 0,
          totalFailed: 0,
          pendingCount: 0,
          isActive: false,
        },
      });
    }

    returnSucess(res, {
      sessionId: session,
      stats: {
        totalProcessed: queueStatus.totalProcessed,
        totalFailed: queueStatus.totalFailed,
        pendingCount: queueStatus.pendingCount,
        isActive: queueStatus.isProcessing,
        lastMessageTime: queueStatus.lastMessageTime,
        estimatedNextSend: queueStatus.estimatedNextSend,
      },
    });
  } catch (error) {
    returnError(req, res, error);
  }
}
