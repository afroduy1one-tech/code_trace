CREATE DATABASE IF NOT EXISTS code_guide
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE code_guide;

CREATE TABLE `user` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  login VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  level ENUM('beginner','experienced') NOT NULL DEFAULT 'beginner',
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  PRIMARY KEY (id), UNIQUE KEY uq_user_login (login)
) ENGINE=InnoDB;

CREATE TABLE project (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  repository_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_user_name (user_id, name),
  CONSTRAINT fk_project_user FOREIGN KEY (user_id) REFERENCES `user`(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE analysis (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  analyzed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  CONSTRAINT fk_analysis_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `file` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id INT UNSIGNED NOT NULL,
  info VARCHAR(255) NULL,
  path VARCHAR(500) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_file_analysis FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `link` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id INT UNSIGNED NOT NULL,
  source_file_id INT UNSIGNED NOT NULL,
  target_file_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_link (analysis_id, source_file_id, target_file_id),
  CONSTRAINT fk_link_analysis FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE,
  CONSTRAINT fk_link_source FOREIGN KEY (source_file_id) REFERENCES `file`(id) ON DELETE CASCADE,
  CONSTRAINT fk_link_target FOREIGN KEY (target_file_id) REFERENCES `file`(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE analysis_result (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id INT UNSIGNED NOT NULL,
  result_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  priority INT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_result_analysis FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applied_rule (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  analysis_id INT UNSIGNED NOT NULL,
  rule_code VARCHAR(50) NOT NULL,
  result_description TEXT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_applied_analysis FOREIGN KEY (analysis_id) REFERENCES analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB;
