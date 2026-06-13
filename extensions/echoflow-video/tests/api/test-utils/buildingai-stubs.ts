export class BaseService<T = unknown> {
    constructor(protected readonly repository?: { delete?: (id: string) => Promise<unknown> }) {}

    protected paginate() {
        return Promise.resolve({ items: [], total: 0 });
    }

    protected delete(id: string) {
        return this.repository?.delete?.(id) ?? Promise.resolve(undefined);
    }
}

export function InjectRepository() {
    return () => undefined;
}

export function ExtensionEntity() {
    return (target: unknown) => target;
}

export class User {}

export class Repository<T = unknown> {}

export function Column() {
    return () => undefined;
}

export function CreateDateColumn() {
    return () => undefined;
}

export function UpdateDateColumn() {
    return () => undefined;
}

export function PrimaryGeneratedColumn() {
    return () => undefined;
}

export function Index() {
    return () => undefined;
}

export function JoinColumn() {
    return () => undefined;
}

export function ManyToOne() {
    return () => undefined;
}

export function Like(value: string) {
    return value;
}

export function buildWhere<T>(value: T): T {
    return value;
}

export const HttpErrorFactory = {
    badRequest(message: string) {
        return new Error(message);
    },
    notFound(message: string) {
        return new Error(message);
    },
};
