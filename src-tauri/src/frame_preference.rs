//! Public WebKitGTK APIs not yet present in the 2.0.2 Rust bindings.
//! Feature toggling is available since 2.42; list lookup since 2.54.
use gtk::prelude::*;
use std::ffi::{c_char, c_int, c_void, CStr};

#[link(name = "webkit2gtk-4.1")]
extern "C" {
    fn webkit_settings_get_all_features() -> *mut c_void;
    fn webkit_feature_list_find(list: *mut c_void, identifier: *const c_char) -> *mut c_void;
    fn webkit_feature_list_unref(list: *mut c_void);
    fn webkit_feature_get_identifier(feature: *mut c_void) -> *const c_char;
    fn webkit_feature_get_default_value(feature: *mut c_void) -> c_int;
    fn webkit_settings_get_feature_enabled(settings: *mut c_void, feature: *mut c_void) -> c_int;
    fn webkit_settings_set_feature_enabled(
        settings: *mut c_void,
        feature: *mut c_void,
        enabled: c_int,
    );
}

pub fn configure(
    settings: &webkit2gtk::Settings,
    requested: &str,
) -> Result<serde_json::Value, String> {
    let enabled = match requested {
        "default" => None,
        "on" => Some(true),
        "off" => Some(false),
        _ => return Err("--near60 must be default, on or off".into()),
    };
    // Called on the GTK main thread via with_webview. Settings stays alive;
    // the borrowed feature stays alive until its owning list is unreffed.
    unsafe {
        let list = webkit_settings_get_all_features();
        if list.is_null() {
            return Err("WebKit feature list unavailable".into());
        }
        let feature =
            webkit_feature_list_find(list, c"PreferPageRenderingUpdatesNear60FPS".as_ptr());
        if feature.is_null() {
            webkit_feature_list_unref(list);
            return Err("Near60FPS feature not available in this WebKit build".into());
        }
        let ptr = settings.as_ptr().cast();
        let before = webkit_settings_get_feature_enabled(ptr, feature) != 0;
        if let Some(value) = enabled {
            webkit_settings_set_feature_enabled(ptr, feature, value.into());
        }
        let after = webkit_settings_get_feature_enabled(ptr, feature) != 0;
        let value = serde_json::json!({
            "identifier": CStr::from_ptr(webkit_feature_get_identifier(feature)).to_string_lossy(),
            "defaultEnabled": webkit_feature_get_default_value(feature) != 0,
            "requested": requested, "beforeEnabled": before, "effectiveEnabled": after,
        });
        webkit_feature_list_unref(list);
        if enabled.is_some_and(|expected| expected != after) {
            return Err("WebKit feature setting did not take effect".into());
        }
        println!("FRAME_PROBE_PREFERENCE {value}");
        Ok(value)
    }
}
