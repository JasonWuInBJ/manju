# 漫剧工坊 (ComicVideo Studio)

> ⚠️ **测试版声明**：本项目目前处于测试初期阶段，存在部分 bug 和不完善之处，欢迎反馈问题。

一款基于 AI 的漫剧视频生成工具，支持从剧本到视频的全流程自动化创作。

## 功能特性

- **剧本生成**：导入网络小说文本，AI 自动改编为短剧剧本
- **角色设计**：创建角色形象，AI 生成角色参考图
- **场景设计**：设计场景背景，AI 生成场景参考图
- **道具管理**：提取剧本道具，AI 生成道具参考图
- **分镜编辑**：AI 自动生成分镜脚本，支持手动调整
- **视频生成**：支持多种生成模式，一键生成 AI 视频

---

## 从零开始安装指南

### 第一步：安装 Docker

本项目使用 Docker 部署，无需手动配置 Node.js 环境。

#### Windows

1. 下载 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. 运行安装程序，按提示完成安装
3. 安装完成后重启电脑
4. 打开 Docker Desktop，等待启动完成（任务栏图标稳定）

#### macOS

1. 下载 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. 将 Docker 拖入 Applications 文件夹
3. 打开 Docker，等待启动完成

#### Linux (Ubuntu/Debian)

```bash
# 更新软件包索引
sudo apt-get update

# 安装依赖
sudo apt-get install ca-certificates curl gnupg

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 软件源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker
```

#### 验证安装

```bash
docker --version
docker compose version
```

---

### 第二步：克隆项目

```bash
# 克隆仓库
[git clone https://github.com/JasonWuInBJ/manju.git](https://github.com/JasonWuInBJ/manju.git)

# 进入项目目录
cd manju/app
```

> 如果没有安装 Git，可以从 GitHub 页面下载 ZIP 压缩包并解压。

---

### 第三步：启动服务

```bash
# 在 app 目录下执行
docker-compose up -d
```

首次启动会自动构建镜像，需要等待几分钟。后续启动会直接使用已构建的镜像，速度很快。

---

### 第四步：访问应用

启动成功后，打开浏览器访问：

- **主地址**：http://localhost:3000
- **备用地址**：http://localhost:13000（如果主地址无法访问）

看到漫剧工坊的首页即表示安装成功！

---

### 第五步：配置 API Key

首次使用需要配置 AI 服务的 API Key：

1. 点击页面右上角「系统设置」
2. 填写以下 Key：

| 服务 | 用途 | 获取方式 |
|------|------|----------|
| GLM API Key | 文本生成（剧本、分镜等） | [智谱 AI 开放平台](https://bigmodel.cn/) |
| RunningHub API Key | 图片生成、视频生成 | [RunningHub](https://www.runninghub.ai/) |
| Anthropic API Key | 可选，文本生成备选 | [Anthropic 官网](https://console.anthropic.com/) |

> 也可以通过环境变量提前配置，创建 `.env` 文件或直接设置环境变量。

---

## 常用操作

### 查看日志

```bash
docker compose logs -f
```

### 停止服务

```bash
docker compose down
```

### 重启服务

```bash
docker compose restart
```

### 更新到最新版本

```bash
git pull
docker compose up -d --build
```

### 清理重装

```bash
# 停止并删除容器（保留数据）
docker compose down

# 停止并删除容器和数据（完全重置）
docker compose down -v
docker compose up -d --build
```

---

## 使用流程简述

1. **创建项目** - 点击「新建项目」，输入项目名称
2. **编写剧本** - 粘贴小说原文，AI 自动生成剧本
3. **设计角色** - 提取角色，生成角色参考图
4. **设计场景** - 提取场景，生成场景参考图
5. **编辑分镜** - AI 生成分镜脚本
6. **生成视频** - 选择素材，一键生成视频

详细使用说明请参考 [app/README.md](./app/README.md)。

---

## 技术栈

- **前端框架**：Next.js 16 + React 19
- **UI 组件**：Tailwind CSS + shadcn/ui
- **数据库**：SQLite + Prisma ORM
- **AI 服务**：Anthropic Claude / 智谱 GLM

---

## 项目结构

```
waoowaoo/
├── app/                 # 主应用目录
│   ├── app/            # Next.js App Router
│   ├── components/     # React 组件
│   ├── lib/           # 工具函数
│   ├── prisma/        # 数据库 Schema
│   └── docker-compose.yml
├── docs/               # 项目文档
│   ├── PRD.md         # 产品需求文档
│   └── *.md           # 各模块文档
└── README.md          # 本文件
```

---

## 常见问题

### 1. Docker 启动失败

确保 Docker Desktop 正在运行，并且没有端口冲突（3000 端口被占用）。

### 2. 页面无法访问

检查容器是否正常运行：

```bash
docker compose ps
```

### 3. 生成内容失败

检查 API Key 是否正确配置，可在系统设置中重新填写。

### 4. 数据丢失

项目使用 Docker Volume 持久化数据，正常重启不会丢失。使用 `docker compose down -v` 会删除数据。

---

## 反馈与贡献

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

## 许可证

MIT License
