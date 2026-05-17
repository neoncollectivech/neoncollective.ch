export class AdminApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AdminApiError";
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AdminApiError {
  constructor(message = "Not found.") {
    super(message, 404);
  }
}

export class ConflictError extends AdminApiError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class BadRequestError extends AdminApiError {
  constructor(message: string) {
    super(message, 400);
  }
}
