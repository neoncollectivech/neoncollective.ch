export class ResourceApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ResourceApiError";
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends ResourceApiError {
  constructor(message = "Not found.") {
    super(message, 404);
  }
}

export class ConflictError extends ResourceApiError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class BadRequestError extends ResourceApiError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class BulkLimitError extends BadRequestError {
  constructor(limit: number) {
    super(`Bulk operation exceeds maximum batch size of ${limit}.`);
  }
}
