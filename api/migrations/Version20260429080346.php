<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260429080346 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Wissenspool: knowledge_base_*-Tabellen (inkl. thumbnail_url, team_id nullable); Doctrine-Indexsync für bestehende Tabellen';
    }

    public function up(Schema $schema): void
    {
        // ── knowledge_base_categories ────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_categories (
                id         INT AUTO_INCREMENT NOT NULL,
                team_id    INT DEFAULT NULL,
                created_by INT DEFAULT NULL,
                name       VARCHAR(100) NOT NULL,
                icon       VARCHAR(10)  DEFAULT NULL,
                sort_order INT          DEFAULT 0 NOT NULL,
                created_at DATETIME     NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_knowledge_base_categories_created_by (created_by),
                INDEX idx_knowledge_base_categories_team_id    (team_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── knowledge_base_post_comments ─────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_post_comments (
                id         INT AUTO_INCREMENT NOT NULL,
                post_id    INT      NOT NULL,
                user_id    INT      NOT NULL,
                content    LONGTEXT NOT NULL,
                created_at DATETIME NOT NULL    COMMENT '(DC2Type:datetime_immutable)',
                updated_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_knowledge_base_post_comments_post_id (post_id),
                INDEX idx_knowledge_base_post_comments_user_id (user_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── knowledge_base_post_likes ────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_post_likes (
                id         INT AUTO_INCREMENT NOT NULL,
                post_id    INT      NOT NULL,
                user_id    INT      NOT NULL,
                created_at DATETIME NOT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX        idx_knowledge_base_post_likes_user_id (user_id),
                INDEX        idx_knowledge_base_post_likes_post_id (post_id),
                UNIQUE INDEX uniq_knowledge_base_like_post_user    (post_id, user_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── knowledge_base_post_media ────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_post_media (
                id            INT AUTO_INCREMENT NOT NULL,
                post_id       INT           NOT NULL,
                url           VARCHAR(2048) NOT NULL,
                media_type    VARCHAR(20)   NOT NULL,
                label         VARCHAR(255)  DEFAULT NULL,
                external_id   VARCHAR(255)  DEFAULT NULL,
                thumbnail_url VARCHAR(2048) DEFAULT NULL,
                INDEX idx_knowledge_base_post_media_post_id (post_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── knowledge_base_posts ─────────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_posts (
                id                INT AUTO_INCREMENT NOT NULL,
                team_id           INT          DEFAULT NULL,
                category_id       INT          NOT NULL,
                created_by        INT          NOT NULL,
                updated_by        INT          DEFAULT NULL,
                title             VARCHAR(255) NOT NULL,
                description       LONGTEXT     DEFAULT NULL,
                is_pinned         TINYINT(1)   DEFAULT 0 NOT NULL,
                send_notification TINYINT(1)   DEFAULT 0 NOT NULL,
                created_at        DATETIME     NOT NULL    COMMENT '(DC2Type:datetime_immutable)',
                updated_at        DATETIME     DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)',
                INDEX idx_knowledge_base_posts_updated_by  (updated_by),
                INDEX idx_knowledge_base_posts_team_id     (team_id),
                INDEX idx_knowledge_base_posts_category_id (category_id),
                INDEX idx_knowledge_base_posts_created_by  (created_by),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── knowledge_base_post_tags ─────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_post_tags (
                knowledge_base_post_id INT NOT NULL,
                knowledge_base_tag_id  INT NOT NULL,
                INDEX idx_knowledge_base_post_tags_post_id (knowledge_base_post_id),
                INDEX idx_knowledge_base_post_tags_tag_id  (knowledge_base_tag_id),
                PRIMARY KEY(knowledge_base_post_id, knowledge_base_tag_id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── knowledge_base_tags ──────────────────────────────────────────────────
        $this->addSql(<<<'SQL'
            CREATE TABLE knowledge_base_tags (
                id      INT AUTO_INCREMENT NOT NULL,
                team_id INT         DEFAULT NULL,
                name    VARCHAR(50) NOT NULL,
                INDEX        idx_knowledge_base_tags_team_id   (team_id),
                UNIQUE INDEX uniq_knowledge_base_tag_name_team (name, team_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        SQL);

        // ── Foreign Keys ─────────────────────────────────────────────────────────
        $this->addSql('ALTER TABLE knowledge_base_categories ADD CONSTRAINT fk_knowledge_base_categories_team_id    FOREIGN KEY (team_id)    REFERENCES teams (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE knowledge_base_categories ADD CONSTRAINT fk_knowledge_base_categories_created_by  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL');

        $this->addSql('ALTER TABLE knowledge_base_post_comments ADD CONSTRAINT fk_knowledge_base_post_comments_post_id FOREIGN KEY (post_id) REFERENCES knowledge_base_posts (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE knowledge_base_post_comments ADD CONSTRAINT fk_knowledge_base_post_comments_user_id FOREIGN KEY (user_id) REFERENCES users (id)');

        $this->addSql('ALTER TABLE knowledge_base_post_likes ADD CONSTRAINT fk_knowledge_base_post_likes_post_id FOREIGN KEY (post_id) REFERENCES knowledge_base_posts (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE knowledge_base_post_likes ADD CONSTRAINT fk_knowledge_base_post_likes_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE');

        $this->addSql('ALTER TABLE knowledge_base_post_media ADD CONSTRAINT fk_knowledge_base_post_media_post_id FOREIGN KEY (post_id) REFERENCES knowledge_base_posts (id) ON DELETE CASCADE');

        $this->addSql('ALTER TABLE knowledge_base_posts ADD CONSTRAINT fk_knowledge_base_posts_team_id     FOREIGN KEY (team_id)     REFERENCES teams                    (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE knowledge_base_posts ADD CONSTRAINT fk_knowledge_base_posts_category_id FOREIGN KEY (category_id) REFERENCES knowledge_base_categories (id)');
        $this->addSql('ALTER TABLE knowledge_base_posts ADD CONSTRAINT fk_knowledge_base_posts_created_by  FOREIGN KEY (created_by)  REFERENCES users                    (id)');
        $this->addSql('ALTER TABLE knowledge_base_posts ADD CONSTRAINT fk_knowledge_base_posts_updated_by  FOREIGN KEY (updated_by)  REFERENCES users                    (id) ON DELETE SET NULL');

        $this->addSql('ALTER TABLE knowledge_base_post_tags ADD CONSTRAINT fk_knowledge_base_post_tags_post_id FOREIGN KEY (knowledge_base_post_id) REFERENCES knowledge_base_posts (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE knowledge_base_post_tags ADD CONSTRAINT fk_knowledge_base_post_tags_tag_id  FOREIGN KEY (knowledge_base_tag_id)  REFERENCES knowledge_base_tags  (id) ON DELETE CASCADE');

        $this->addSql('ALTER TABLE knowledge_base_tags ADD CONSTRAINT fk_knowledge_base_tags_team_id FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // ── Foreign Keys droppen ──────────────────────────────────────────────────
        $this->addSql('ALTER TABLE knowledge_base_categories    DROP FOREIGN KEY fk_knowledge_base_categories_team_id');
        $this->addSql('ALTER TABLE knowledge_base_categories    DROP FOREIGN KEY fk_knowledge_base_categories_created_by');
        $this->addSql('ALTER TABLE knowledge_base_post_comments DROP FOREIGN KEY fk_knowledge_base_post_comments_post_id');
        $this->addSql('ALTER TABLE knowledge_base_post_comments DROP FOREIGN KEY fk_knowledge_base_post_comments_user_id');
        $this->addSql('ALTER TABLE knowledge_base_post_likes    DROP FOREIGN KEY fk_knowledge_base_post_likes_post_id');
        $this->addSql('ALTER TABLE knowledge_base_post_likes    DROP FOREIGN KEY fk_knowledge_base_post_likes_user_id');
        $this->addSql('ALTER TABLE knowledge_base_post_media    DROP FOREIGN KEY fk_knowledge_base_post_media_post_id');
        $this->addSql('ALTER TABLE knowledge_base_posts         DROP FOREIGN KEY fk_knowledge_base_posts_team_id');
        $this->addSql('ALTER TABLE knowledge_base_posts         DROP FOREIGN KEY fk_knowledge_base_posts_category_id');
        $this->addSql('ALTER TABLE knowledge_base_posts         DROP FOREIGN KEY fk_knowledge_base_posts_created_by');
        $this->addSql('ALTER TABLE knowledge_base_posts         DROP FOREIGN KEY fk_knowledge_base_posts_updated_by');
        $this->addSql('ALTER TABLE knowledge_base_post_tags     DROP FOREIGN KEY fk_knowledge_base_post_tags_post_id');
        $this->addSql('ALTER TABLE knowledge_base_post_tags     DROP FOREIGN KEY fk_knowledge_base_post_tags_tag_id');
        $this->addSql('ALTER TABLE knowledge_base_tags          DROP FOREIGN KEY fk_knowledge_base_tags_team_id');

        // ── Tabellen droppen ─────────────────────────────────────────────────────
        $this->addSql('DROP TABLE knowledge_base_categories');
        $this->addSql('DROP TABLE knowledge_base_post_comments');
        $this->addSql('DROP TABLE knowledge_base_post_likes');
        $this->addSql('DROP TABLE knowledge_base_post_media');
        $this->addSql('DROP TABLE knowledge_base_posts');
        $this->addSql('DROP TABLE knowledge_base_post_tags');
        $this->addSql('DROP TABLE knowledge_base_tags');
    }

    public function isTransactional(): bool
    {
        return false;
    }
}
