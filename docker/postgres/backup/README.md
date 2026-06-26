# PostgreSQL 数据库备份说明

## 备份目录结构
```
docker/postgres/backup/
├── backups/          # 备份文件存储目录（按日期命名）
├── backup.sh         # Linux/Docker 备份脚本
├── backup.ps1        # Windows PowerShell 备份脚本
└── restore.sh        # 恢复脚本
```

## 手动备份

### Windows (PowerShell)
```powershell
# 执行备份
.\docker\postgres\backup\backup.ps1

# 备份文件会保存到 docker/postgres/backup/backups/ 目录
```

### Docker 容器内执行
```bash
# 进入项目目录后执行
docker exec buildingai-postgres pg_dump -U postgres -d buildingai > docker/postgres/backup/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

## 自动定时备份（Linux 服务器）

使用 crontab 设置每天凌晨2点自动备份：

```bash
# 编辑 crontab
crontab -e

# 添加以下内容（每天凌晨2点备份，保留最近7天）
0 2 * * * cd /path/to/BuildingAI && docker exec buildingai-postgres pg_dump -U postgres -d buildingai | gzip > /path/to/BuildingAI/docker/postgres/backup/backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz && find /path/to/BuildingAI/docker/postgres/backup/backups/ -name "*.sql.gz" -mtime +7 -delete
```

## 恢复备份

```bash
# 1. 停止应用容器（保持postgres运行）
docker compose stop nodejs

# 2. 恢复备份（替换为你的备份文件路径）
cat docker/postgres/backup/backups/backup_YYYYMMDD_HHMMSS.sql | docker exec -i buildingai-postgres psql -U postgres -d buildingai

# 3. 重启应用
docker compose start nodejs
```

或者使用恢复脚本：
```bash
# Linux/Mac
bash docker/postgres/backup/restore.sh backups/backup_YYYYMMDD_HHMMSS.sql

# Windows
.\docker\postgres\backup\restore.ps1 backups/backup_YYYYMMDD_HHMMSS.sql
```
