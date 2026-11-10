//! GUI of the FTP client (egui / eframe).
//!
//! The GUI runs on the main thread and never waits for the network. Pressing
//! "Download" only parses the URL and calls [`download::spawn`], which starts a
//! worker thread and returns at once. Each frame the GUI reads the atomic
//! counters of every download and draws one progress bar per download.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use eframe::egui::{self, Color32, RichText};
use ftp_client::download::{self, DownloadState, FtpUrl, Notify, Status, DEFAULT_BASE};

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("FTP client")
            .with_inner_size([820.0, 420.0])
            .with_min_inner_size([560.0, 260.0]),
        ..Default::default()
    };
    eframe::run_native(
        "FTP client",
        options,
        Box::new(|cc| Ok(Box::new(App::new(cc.egui_ctx.clone())))),
    )
}

struct App {
    /// Text of the URL field.
    url_input: String,
    /// Error shown under the URL field (invalid URL, duplicate download).
    input_error: Option<String>,
    /// All downloads, newest last. The worker threads hold the other `Arc`s.
    downloads: Vec<Arc<DownloadState>>,
    /// Folder where finished files are stored.
    dest_dir: PathBuf,
    /// Repaint callback handed to every worker thread.
    notify: Notify,
}

impl App {
    fn new(ctx: egui::Context) -> Self {
        let dest_dir = std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("downloads");
        let _ = std::fs::create_dir_all(&dest_dir);
        App {
            url_input: String::new(),
            input_error: None,
            downloads: Vec::new(),
            dest_dir,
            // `egui::Context` is thread safe; asking for a repaint from a
            // worker thread wakes the GUI up even when the mouse does not move.
            notify: Arc::new(move || ctx.request_repaint()),
        }
    }

    /// Called by the Download button and by Enter in the URL field.
    fn start_from_input(&mut self) {
        match FtpUrl::parse(&self.url_input) {
            Ok(url) => {
                // Two threads must not write into the same local file.
                let busy = self.downloads.iter().any(|d| {
                    d.url.file_name == url.file_name && d.status().is_active()
                });
                if busy {
                    self.input_error = Some(format!("{} is already being downloaded", url.file_name));
                    return;
                }
                self.start(url);
                self.input_error = None;
                self.url_input.clear();
            }
            Err(e) => self.input_error = Some(e),
        }
    }

    fn start(&mut self, url: FtpUrl) {
        let state = download::spawn(url, self.dest_dir.clone(), Arc::clone(&self.notify));
        self.downloads.push(state);
    }

    /// Top part of the window: URL field and Download button.
    fn url_bar(&mut self, ui: &mut egui::Ui) {
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.label("URL:");
            let button_width = 90.0;
            let edit = egui::TextEdit::singleline(&mut self.url_input)
                .hint_text(format!("{DEFAULT_BASE}current_file_holdings.json.gz"))
                .desired_width(ui.available_width() - button_width - 10.0);
            let response = ui.add(edit);
            let enter = response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));
            let clicked = ui.add_sized([button_width, 20.0], egui::Button::new("Download")).clicked();
            if enter || clicked {
                self.start_from_input();
                response.request_focus();
            }
        });
        if let Some(err) = &self.input_error {
            ui.colored_label(Color32::from_rgb(210, 60, 60), err);
        }
        ui.add_space(4.0);
    }

    /// One row per download: name, progress bar, details, action button.
    fn download_list(&mut self, ui: &mut egui::Ui) {
        if self.downloads.is_empty() {
            ui.weak("No downloads yet. Enter an ftp:// URL or just a file name from ftp.bmrb.io/pdb/holdings.");
            return;
        }
        let mut retry = None;
        let mut remove = None;
        egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
            egui::Grid::new("downloads")
                .num_columns(4)
                .spacing([12.0, 8.0])
                .striped(true)
                .show(ui, |ui| {
                    for (i, d) in self.downloads.iter().enumerate() {
                        let status = d.status();
                        ui.label(&d.url.file_name).on_hover_text(format!(
                            "ftp://{}:{}{}",
                            d.url.host, d.url.port, d.url.path
                        ));
                        ui.add(progress_bar(d, &status));
                        ui.label(details(d, &status));
                        if status.is_active() {
                            if ui.button("Cancel").clicked() {
                                d.cancel();
                            }
                        } else {
                            ui.horizontal(|ui| {
                                if matches!(status, Status::Failed(_) | Status::Cancelled)
                                    && ui.button("Retry").clicked()
                                {
                                    retry = Some(i);
                                }
                                if ui.button("✖").on_hover_text("Remove from list").clicked() {
                                    remove = Some(i);
                                }
                            });
                        }
                        ui.end_row();
                    }
                });
        });
        // The list is modified only after drawing it.
        if let Some(i) = retry {
            let url = self.downloads.remove(i).url.clone();
            self.start(url);
        } else if let Some(i) = remove {
            self.downloads.remove(i);
        }
    }

    fn footer(&mut self, ui: &mut egui::Ui) {
        ui.add_space(4.0);
        ui.horizontal(|ui| {
            let active = self.downloads.iter().filter(|d| d.status().is_active()).count();
            ui.label(format!("Active: {active}"));
            ui.separator();
            ui.weak(format!("Saving to {}", self.dest_dir.display()));
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.button("Clear finished").clicked() {
                    self.downloads.retain(|d| d.status().is_active());
                }
            });
        });
        ui.add_space(4.0);
    }
}

impl eframe::App for App {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        egui::Panel::top("url_bar").show(ui, |ui| self.url_bar(ui));
        egui::Panel::bottom("footer").show(ui, |ui| self.footer(ui));
        egui::CentralPanel::default().show(ui, |ui| self.download_list(ui));

        // Workers request repaints themselves; this periodic repaint only keeps
        // animations (unknown size, retry countdown) smooth while work is going on.
        if self.downloads.iter().any(|d| d.status().is_active()) {
            ui.ctx().request_repaint_after(Duration::from_millis(250));
        }
    }
}

/// Progress bar coloured by status. Unknown size gives an animated bar.
fn progress_bar(d: &DownloadState, status: &Status) -> egui::ProgressBar {
    let fraction = match status {
        Status::Done { .. } => Some(1.0),
        _ => d.fraction(),
    };
    let bar = egui::ProgressBar::new(fraction.unwrap_or(0.0)).desired_width(220.0);
    let bar = match fraction {
        Some(f) => bar.text(format!("{:.0}%", f * 100.0)),
        None => bar.animate(status.is_active()),
    };
    match status {
        Status::Done { .. } => bar.fill(Color32::from_rgb(60, 150, 80)),
        Status::Failed(_) => bar.fill(Color32::from_rgb(190, 60, 60)),
        Status::Cancelled => bar.fill(Color32::GRAY),
        Status::Retrying { .. } => bar.fill(Color32::from_rgb(200, 150, 40)),
        _ => bar,
    }
}

/// Text next to the bar: sizes, speed, remaining time or the error.
fn details(d: &DownloadState, status: &Status) -> RichText {
    let done = d.downloaded();
    let sizes = match d.total() {
        Some(t) => format!("{} / {}", human(done), human(t)),
        None => human(done),
    };
    match status {
        Status::Connecting => RichText::new("connecting…"),
        Status::Downloading => {
            let speed = d.speed();
            let eta = match (d.total(), speed) {
                (Some(t), s) if s > 0 => format!(", {} left", human_time(t.saturating_sub(done) / s)),
                _ => String::new(),
            };
            RichText::new(format!("{sizes}  {}/s{eta}", human(speed)))
        }
        Status::Retrying { attempt, reason } => {
            RichText::new(format!("{reason}; retrying (attempt {} failed)…", attempt))
                .color(Color32::from_rgb(200, 150, 40))
        }
        Status::Done { .. } => RichText::new(format!("done, {sizes}")).color(Color32::from_rgb(60, 150, 80)),
        Status::Failed(msg) => RichText::new(format!("error: {msg}")).color(Color32::from_rgb(210, 60, 60)),
        Status::Cancelled => RichText::new("cancelled").weak(),
    }
}

fn human(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut v = bytes as f64;
    let mut u = 0;
    while v >= 1024.0 && u < UNITS.len() - 1 {
        v /= 1024.0;
        u += 1;
    }
    if u == 0 { format!("{bytes} B") } else { format!("{v:.1} {}", UNITS[u]) }
}

fn human_time(secs: u64) -> String {
    if secs >= 60 { format!("{}m {:02}s", secs / 60, secs % 60) } else { format!("{secs}s") }
}
