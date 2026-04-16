import morgan from 'morgan';
import logger from '../utils/logger';

export const requestLogger = morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
});
