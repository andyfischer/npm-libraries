import { RequestDispatch } from "../RequestDispatch";
import HTTP from 'http'
import WebSocket from 'ws';
import { createNestedLoggerStream } from "@andyfischer/streams";
import { WebSocketServer, ServerOptions as WebSocketServerOptions } from "./WebSocketServer";
import { HttpRequestHandler } from "./HttpRequestHandler";

interface ServerSettings {
    api?: RequestDispatch<any>
    webServer?: { handle: (req, res) => void }
    enableWebSocket?: boolean
    webSocketSettings?: WebSocketServerOptions<any>
    port: number | string
}

interface ActiveHttpServer {
    webSocketServer?: WebSocketServer<any> | null
    close(): void
    port: number
}

export async function startHttpServer(settings: ServerSettings): Promise<ActiveHttpServer> {
    const httpServer = HTTP.createServer();

    const log = createNestedLoggerStream('HttpServer');
    let webSocketServer: WebSocketServer<any> | null = null;

    if (settings.enableWebSocket && settings.api) {
        const wsServer = new WebSocket.Server({
            server: httpServer
        });

        webSocketServer = new WebSocketServer({
            wsServer,
            api: settings.api,
            logStream: log,

            ...settings.webSocketSettings,
        });
    }

    let apiHandler: HttpRequestHandler | null = null;

    if (settings.api) {
        apiHandler = new HttpRequestHandler({
            api: settings.api,
        });
    }

    httpServer.on('request', (req, res) => {
        const path = req.url!.split('?')[0];

        if (path === '/favicon.ico') {
            res.writeHead(404);
            res.end();
            return;
        }

        if (apiHandler && path === '/api') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            apiHandler.handleHttpRequest(req, res);
            return;
        }

        if (settings.webServer) {
            settings.webServer.handle(req, res);
            return;
        }

        console.warn('[HttpServer] Requested path not found:', path);
        res.writeHead(404);
        res.write('Not found');
        res.end();
    });

    let port = settings.port;
    if (typeof port === 'string') {
        port = parseInt(port);
    }

    await listen(httpServer, port);

    log.info('Server is now listening on port: ' + port);

    const result: ActiveHttpServer = {
        webSocketServer,
        port,
        close() {
            httpServer.close();
            if (webSocketServer)
                webSocketServer.close();
        }
    };

    return result;
}

async function attemptListen(app, port) {
    return new Promise((resolve, reject) => {
      const listener = app.listen(port, () => {
        resolve(listener);
      });
  
      listener.on('error', (err) => {
        reject(err);
        listener.close();
      });
    });
  }


async function listen(app, port) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await attemptListen(app, port);
        return;
      } catch (e) {
        if (e.code === 'EADDRINUSE') {
          console.log(`Port ${port} is in use, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
  
        // unexpected error
        throw e;
      }
    }
  }
