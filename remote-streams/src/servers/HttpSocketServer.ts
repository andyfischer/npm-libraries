import HTTP from 'http'
import WebSocket from 'ws';
import { createNestedLoggerStream } from "@andyfischer/streams";
import { WebSocketServer, ServerOptions as WebSocketServerOptions } from "./WebSocketServer";
import { HttpRequestHandler } from "./HttpRequestHandler";

interface ServerSettings {
    handleRequest?: (req: any, connection: any, output: any) => void
    requestPath?: string
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

export async function setupHttpServer(settings: ServerSettings): Promise<ActiveHttpServer> {
    const httpServer = HTTP.createServer();

    const log = createNestedLoggerStream('HttpServer');
    let webSocketServer: WebSocketServer<any> | null = null;
    const requestPath = settings.requestPath || '/api';

    if (!requestPath.startsWith('/')) {
        throw new Error('requestPath must start with a /');
    }

    if (settings.enableWebSocket) {
        const wsServer = new WebSocket.Server({
            server: httpServer
        });

        webSocketServer = new WebSocketServer({
            wsServer,
            handleRequest: settings.handleRequest,
            logStream: log,

            ...settings.webSocketSettings,
        });
    }

    let requestHandler: HttpRequestHandler | null = null;

    if (settings.handleRequest) {
        requestHandler = new HttpRequestHandler({
            handleRequest: settings.handleRequest,
        });
    }

    httpServer.on('request', (req, res) => {
        const path = req.url!.split('?')[0];

        if (path === '/favicon.ico') {
            res.writeHead(404);
            res.end();
            return;
        }

        if (requestHandler && path === requestPath) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            requestHandler.handleHttpRequest(req, res);
            return;
        }

        if (settings.webServer) {
            settings.webServer.handle(req, res);
            return;
        }

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
