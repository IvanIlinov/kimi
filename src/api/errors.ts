// Ошибка с HTTP-кодом: сообщение уходит клиенту как есть
export class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}
