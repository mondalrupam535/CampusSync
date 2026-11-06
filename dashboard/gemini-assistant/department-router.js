'use strict';

const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const defaultJarPath = path.resolve(__dirname, '..', '..', '..', 'dept', 'target', 'department-router-1.0-shaded.jar');
const pending = new Map();
let routerProcess = null;

function rejectPending(error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function getRouterProcess() {
  if (routerProcess && routerProcess.exitCode === null && !routerProcess.killed) {
    return routerProcess;
  }

  const jarPath = path.resolve(process.env.DEPARTMENT_ROUTER_JAR || defaultJarPath);
  if (!fs.existsSync(jarPath)) {
    throw new Error(
      `Department router JAR not found at "${jarPath}". Build the router or set DEPARTMENT_ROUTER_JAR.`
    );
  }

  const child = spawn(
    process.env.JAVA_COMMAND || 'java',
    ['--enable-native-access=ALL-UNNAMED', '-jar', jarPath, '--json-lines'],
    { cwd: path.dirname(jarPath), stdio: ['pipe', 'pipe', 'pipe'] }
  );
  routerProcess = child;

  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let response;
    try {
      response = JSON.parse(line);
    } catch (error) {
      console.error('Department router returned invalid JSON:', error.message);
      rejectPending(new Error('The department router returned an invalid response.'));
      child.kill();
      return;
    }

    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (typeof response.error === 'string') {
      request.reject(new Error(response.error));
    } else if (Array.isArray(response.departments)) {
      request.resolve(response.departments);
    } else {
      request.reject(new Error('The department router returned an incomplete response.'));
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (text) => process.stderr.write(`[department-router] ${text}`));
  child.on('error', (error) => {
    if (routerProcess === child) routerProcess = null;
    rejectPending(new Error(`Could not start the department router: ${error.message}`));
  });
  child.on('exit', (code, signal) => {
    if (routerProcess === child) routerProcess = null;
    if (pending.size) {
      rejectPending(new Error(`The department router exited unexpectedly (${signal || code}).`));
    }
  });
  return child;
}

function classifyDepartments(message) {
  if (typeof message !== 'string' || !message.trim()) {
    return Promise.reject(new Error('The message to classify must not be blank.'));
  }

  let child;
  try {
    child = getRouterProcess();
  } catch (error) {
    return Promise.reject(error);
  }

  const id = randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ id, message })}\n`, (error) => {
      if (!error) return;
      pending.delete(id);
      reject(new Error(`Could not send the message to the department router: ${error.message}`));
    });
  });
}

module.exports = { classifyDepartments };
