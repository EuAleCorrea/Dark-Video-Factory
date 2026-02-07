import { SystemMetrics, JobStatus } from "../types";

type MetricsListener = (metrics: SystemMetrics) => void;

/**
 * SystemMonitor
 * Simulates low-level hardware telemetry.
 * Reacts to the current "JobStatus" to simulate load spikes during rendering.
 */
export class SystemMonitor {
  private intervalId: any = null;
  private listeners: Set<MetricsListener> = new Set();
  
  // Baseline stats
  private metrics: SystemMetrics = {
    cpuUsage: 12,
    ramUsage: 34,
    gpuUsage: 5,
    dockerStatus: 'CONNECTED',
    activeContainers: 0,
    temperature: 45
  };

  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(getStatusCallback: () => JobStatus | undefined) {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      const status = getStatusCallback();
      this.updateMetrics(status);
      this.notify();
    }, 1000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateMetrics(currentJobStatus: JobStatus | undefined) {
    // Logic: If job is PROCESSING, load increases. 
    // If job is FAILED/COMPLETED/REVIEW, load is idle.
    
    const isUnderLoad = currentJobStatus === JobStatus.PROCESSING;

    if (isUnderLoad) {
      // Simulation of heavy rendering/inference load
      this.metrics.cpuUsage = this.fluctuate(this.metrics.cpuUsage, 60, 95);
      this.metrics.ramUsage = this.fluctuate(this.metrics.ramUsage, 50, 80);
      this.metrics.gpuUsage = this.fluctuate(this.metrics.gpuUsage, 40, 100);
      this.metrics.temperature = this.fluctuate(this.metrics.temperature, 70, 85);
      this.metrics.activeContainers = 1;
    } else {
      // Idle state
      this.metrics.cpuUsage = this.fluctuate(this.metrics.cpuUsage, 5, 15);
      this.metrics.ramUsage = this.fluctuate(this.metrics.ramUsage, 30, 35);
      this.metrics.gpuUsage = this.fluctuate(this.metrics.gpuUsage, 0, 5);
      this.metrics.temperature = this.fluctuate(this.metrics.temperature, 40, 50);
      this.metrics.activeContainers = 0;
    }
  }

  private fluctuate(current: number, min: number, max: number): number {
    const change = (Math.random() - 0.5) * 10; // Random walk
    let next = current + change;
    // Clamp
    if (next < min) next = min;
    if (next > max) next = max;
    return Math.floor(next);
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.metrics }));
  }
}