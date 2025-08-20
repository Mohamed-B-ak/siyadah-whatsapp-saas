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
import bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';

import { clientsArray } from '../util/sessionUtil';

function formatSession(session: string) {
  return session.split(':')[0];
}

const verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  const secureToken = req.serverOptions.secretKey;

  const { session } = req.params;
  const { authorization: authHeader, sessionkey: sessionkeyHeader } =
    req.headers;
  const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const sessionkey = Array.isArray(sessionkeyHeader)
    ? sessionkeyHeader[0]
    : sessionkeyHeader;
  if (!session)
    return res.status(401).send({ message: 'Session not informed' });

  try {
    let tokenDecrypt = '';
    let sessionDecrypt = '';

    // Method 1: Try to parse from session parameter (session:token format)
    try {
      if (session.includes(':')) {
        sessionDecrypt = session.split(':')[0];
        tokenDecrypt = session
          .split(':')[1]
          .replace(/_/g, '/')
          .replace(/-/g, '+');
      }
    } catch (error) {
      // Continue to next method
    }

    // Method 2: Try Authorization Bearer header
    if (!tokenDecrypt && token && token !== '') {
      try {
        if (token.startsWith('Bearer ')) {
          const fullToken = token.split(' ')[1];
          if (fullToken && fullToken.includes(':')) {
            sessionDecrypt = fullToken.split(':')[0];
            tokenDecrypt = fullToken
              .split(':')[1]
              .replace(/_/g, '/')
              .replace(/-/g, '+');
          } else if (fullToken) {
            sessionDecrypt = session;
            tokenDecrypt = fullToken.replace(/_/g, '/').replace(/-/g, '+');
          }
        } else {
          // Direct token without Bearer prefix
          if (token.includes(':')) {
            sessionDecrypt = token.split(':')[0];
            tokenDecrypt = token
              .split(':')[1]
              .replace(/_/g, '/')
              .replace(/-/g, '+');
          } else {
            sessionDecrypt = session;
            tokenDecrypt = token.replace(/_/g, '/').replace(/-/g, '+');
          }
        }
      } catch (e) {
        // Continue to next method
      }
    }

    // Method 3: Try sessionkey header
    if (!tokenDecrypt && sessionkey) {
      try {
        if (sessionkey.includes(':')) {
          sessionDecrypt = sessionkey.split(':')[0];
          tokenDecrypt = sessionkey
            .split(':')[1]
            .replace(/_/g, '/')
            .replace(/-/g, '+');
        } else {
          sessionDecrypt = session;
          tokenDecrypt = sessionkey.replace(/_/g, '/').replace(/-/g, '+');
        }
      } catch (e) {
        // Continue to error
      }
    }

    // If no token found, return error
    if (!tokenDecrypt) {
      return res.status(401).json({
        message: 'Token is not present. Check your header and try again',
      });
    }

    // Use the session name from URL path for verification
    const sessionName = formatSession(req.params.session);

    bcrypt.compare(
      sessionName + secureToken,
      tokenDecrypt,
      function (err, result) {
        if (result) {
          req.session = sessionName;
          req.token = tokenDecrypt;
          req.client = clientsArray[req.session];
          next();
        } else {
          return res
            .status(401)
            .json({ error: 'Check that the Session and Token are correct' });
        }
      }
    );
  } catch (error) {
    req.logger.error(error);
    return res.status(401).json({
      error: 'Check that the Session and Token are correct.',
      message: error,
    });
  }
};

export default verifyToken;
