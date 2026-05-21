import { BadRequestError } from "@neon/admin-crud";

export class BulkLimitError extends BadRequestError {
  constructor(limit: number) {
    super(`Bulk operation exceeds maximum batch size of ${limit}.`);
  }
}
