use crate::config::AppConfig;
use crate::db::DbPool;
use std::sync::Arc;

pub struct AppStateInner {
    pub config: AppConfig,
    pub db: DbPool,
}

pub type SharedState = Arc<AppStateInner>;
