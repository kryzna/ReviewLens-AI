export class PreCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreCheckError';
  }
}

export function preCheck(content: string): void {
  if (!content || content.trim().length < 3) {
    throw new PreCheckError('Message too short.');
  }
}
