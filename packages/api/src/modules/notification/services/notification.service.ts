import { Notification } from "@buildingai/db/entities";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { IsNull, Not, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { CreateNotificationDto, QueryNotificationDto } from "../dto/notification.dto";
import { WebPushService } from "./web-push.service";

@Injectable()
export class NotificationService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
        private readonly webPushService: WebPushService,
    ) {}

    async create(dto: CreateNotificationDto) {
        const notification = await this.notificationRepository.save(
            this.notificationRepository.create({
                userId: dto.userId,
                title: dto.title,
                content: dto.content || null,
                type: dto.type || "system",
                level: dto.level || "info",
                linkUrl: dto.linkUrl || null,
                data: dto.data || {},
            }),
        );

        void this.webPushService.sendWakeup(dto.userId);

        return notification;
    }

    async list(userId: string, query: QueryNotificationDto) {
        const page = Number(query.page || 1);
        const pageSize = Math.min(Number(query.pageSize || 15), 50);
        const where: Record<string, unknown> = { userId };

        if (query.type) {
            where.type = query.type;
        }

        if (query.readStatus === "read") {
            where.readAt = Not(IsNull());
        }

        if (query.readStatus === "unread") {
            where.readAt = IsNull();
        }

        const [items, total] = await this.notificationRepository.findAndCount({
            where,
            order: { createdAt: "DESC" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return { items, total, page, pageSize };
    }

    async unreadCount(userId: string) {
        const count = await this.notificationRepository.count({
            where: { userId, readAt: IsNull() },
        });
        return { count };
    }

    async markRead(userId: string, id: string) {
        const notification = await this.notificationRepository.findOne({ where: { id, userId } });
        if (!notification) {
            throw HttpErrorFactory.notFound("通知不存在");
        }

        if (!notification.readAt) {
            notification.readAt = new Date();
            await this.notificationRepository.save(notification);
        }

        return notification;
    }

    async markAllRead(userId: string) {
        await this.notificationRepository.update(
            { userId, readAt: IsNull() },
            { readAt: new Date() },
        );
        return { success: true };
    }

    async createTestNotification(userId: string) {
        return this.create({
            userId,
            title: "EchoFlowAI 通知测试",
            content: "如果你收到了这条消息，说明应用通知已经可以使用。",
            type: "test",
            level: "info",
            linkUrl: "/",
        });
    }
}
