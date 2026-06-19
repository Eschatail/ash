use keyring::Entry;

const SERVICE: &str = "ai.ash.desktop";

pub fn set_key(provider: &str, key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, provider).map_err(|e| e.to_string())?;
    entry.set_password(key).map_err(|e| e.to_string())
}

pub fn get_key(provider: &str) -> Option<String> {
    let entry = Entry::new(SERVICE, provider).ok()?;
    entry.get_password().ok()
}

pub fn delete_key(provider: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, provider).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}
