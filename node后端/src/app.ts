import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter } from './middleware/rateLimiter';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import registerRoutes from './routes';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use(apiLimiter);

registerRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
