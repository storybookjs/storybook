import { json } from '@polka/parse';
import polka from 'polka';

const PORT = process.env.PORT || 6007;

const server = polka();
server.use(json());

const events: Record<string, unknown>[] = [];
server.post('/event-log', (req, res) => {
  console.log(`Received event ${req.body.eventType}`);
  events.push(req.body);
  res.end('OK');
});

server.get('/event-log', (_req, res) => {
  console.log(`Sending ${events.length} events`);
  res.end(JSON.stringify(events));
});

server.listen(PORT, () => {
  console.log(`Event log listening on ${PORT}`);
});
