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
import { Whatsapp } from '@wppconnect-team/wppconnect';
import { EventEmitter } from 'events';

export const chromiumArgs = [
  // Core security settings for Replit (stable)
  '--no-sandbox', // Disables sandbox
  '--disable-setuid-sandbox', // Additional sandbox disable
  '--disable-dev-shm-usage', // Prevent /dev/shm issues
  '--disable-gpu', // Disable GPU acceleration
  '--disable-web-security', // Disables web security

  // Cache and storage optimization
  '--aggressive-cache-discard', // Aggressively discards cache
  '--disable-cache', // Disables cache
  '--disable-application-cache', // Disables application cache
  '--disable-offline-load-stale-cache', // Disables loading stale offline cache
  '--disk-cache-size=0', // Sets disk cache size to 0

  // Process stability (removed --single-process --no-zygote)
  '--disable-features=VizDisplayCompositor',
  '--memory-pressure-off',
  '--max_old_space_size=2048',

  // Background activities
  '--disable-background-networking', // Disables background networking activities
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',

  // Browser features
  '--disable-default-apps', // Disables default apps
  '--disable-extensions', // Disables extensions
  '--disable-sync', // Disables synchronization
  '--disable-translate', // Disables translation
  '--hide-scrollbars', // Hides scrollbars
  '--metrics-recording-only', // Records metrics only
  '--mute-audio', // Mutes audio
  '--no-first-run', // Skips first run
  '--safebrowsing-disable-auto-update', // Disables Safe Browsing auto-update

  // Certificate and security
  '--ignore-certificate-errors', // Ignores certificate errors
  '--ignore-ssl-errors', // Ignores SSL errors
  '--ignore-certificate-errors-spki-list', // Ignores certificate errors in SPKI list

  // Container optimizations
  '--user-data-dir=/tmp/chrome-user-data',
  '--disable-ipc-flooding-protection',
];
// eslint-disable-next-line prefer-const
export let clientsArray: Whatsapp[] = [];
export const sessions = [];
export const eventEmitter = new EventEmitter();

export function deleteSessionOnArray(session: string): void {
  // Remove from clientsArray object
  if (clientsArray[session]) {
    delete clientsArray[session];
  }

  // Also remove from any other session tracking arrays/objects
  const sessionIndex = Object.keys(clientsArray).indexOf(session);
  if (sessionIndex > -1) {
    delete clientsArray[session];
  }
}
