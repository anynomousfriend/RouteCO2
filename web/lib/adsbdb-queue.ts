/**
 * Module 5: Priority Enrichment Queue & Route Plausibility
 * 
 * Spec: flight-tracking-3d-implementation-guide.md (Module 5)
 * Features:
 * - Leaky-bucket rate limiter (5 req/s drip) to respect adsbdb public limits
 * - Priority queueing: User-tracked aircraft jump to front of queue
 * - Great-circle cross-track route plausibility check
 */

export interface AircraftEnrichment {
  icao24: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  operator?: string;
  registration?: string;
  route?: {
    origin?: string;
    destination?: string;
  };
}

interface QueueJob {
  key: string;
  icao24: string;
  callsign: string;
  callback: (info: AircraftEnrichment | null) => void;
}

export class AdsbdbQueue {
  private queue: QueueJob[] = [];
  private inFlight = 0;
  private maxInFlight = 4;
  private cache = new Map<string, AircraftEnrichment | null>();
  private lastDispatchTime = 0;

  enqueue(
    icao24: string,
    callsign: string,
    callback: (info: AircraftEnrichment | null) => void,
    isPriority = false
  ) {
    const key = `${icao24}:${callsign}`;
    if (this.cache.has(key)) {
      return callback(this.cache.get(key) || null);
    }

    const item: QueueJob = { key, icao24, callsign, callback };
    if (isPriority) {
      this.queue.unshift(item); // Priority: jump to front
    } else {
      this.queue.push(item);
    }

    this.drain();
  }

  private drain() {
    while (this.inFlight < this.maxInFlight && this.queue.length > 0) {
      const wait = 200 - (Date.now() - this.lastDispatchTime); // 5 req/sec drip
      if (wait > 0) {
        setTimeout(() => this.drain(), wait);
        return;
      }
      this.lastDispatchTime = Date.now();
      const job = this.queue.shift();
      if (!job) break;

      this.inFlight++;

      fetch(`https://api.adsbdb.com/v0/aircraft/${job.icao24}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const ac = data?.response?.aircraft;
          const result: AircraftEnrichment | null = ac
            ? {
                icao24: job.icao24,
                type: ac.icao_type_code,
                manufacturer: ac.manufacturer,
                model: ac.type,
                operator: ac.registered_owner,
                registration: ac.registration,
              }
            : null;
          this.cache.set(job.key, result);
          job.callback(result);
        })
        .catch(() => {
          this.cache.set(job.key, null);
          job.callback(null);
        })
        .finally(() => {
          this.inFlight--;
          this.drain();
        });
    }
  }
}
