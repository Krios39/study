//! FTP download client. The download engine lives in [`download`] and is
//! independent of the GUI, so it can also be tested without a window.

pub mod download;
