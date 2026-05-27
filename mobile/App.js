import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import {
  DEFAULT_API_BASE_URL,
  checkReady,
  createContact,
  deleteContact,
  listContacts,
  updateContact
} from "./src/api";

const EMPTY_CONTACT = {
  first_name: "",
  last_name: "",
  address: "",
  phone_number: "",
  extra_fields: {}
};

const EMPTY_FILTERS = {
  keyword: "",
  first_name: "",
  last_name: "",
  address: ""
};

function displayName(contact) {
  return `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unnamed contact";
}

function contactInitials(contact) {
  const first = (contact.first_name || "").charAt(0);
  const last = (contact.last_name || "").charAt(0);
  return `${first}${last}`.trim().toUpperCase() || "?";
}

function cloneContact(contact) {
  return {
    first_name: contact.first_name || "",
    last_name: contact.last_name || "",
    address: contact.address || "",
    phone_number: contact.phone_number || "",
    extra_fields: { ...(contact.extra_fields || {}) }
  };
}

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [form, setForm] = useState(EMPTY_CONTACT);
  const [fieldName, setFieldName] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId),
    [contacts, selectedContactId]
  );

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await listContacts(apiBaseUrl, filters);
      setContacts(results);
      setStatus(`${results.length} contact${results.length === 1 ? "" : "s"} loaded`);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  function setFormValue(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setFilterValue(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setSelectedContactId(null);
    setForm(EMPTY_CONTACT);
    setFieldName("");
    setFieldValue("");
    setStatus("Ready for a new contact");
  }

  function startEdit(contact) {
    setSelectedContactId(contact.id);
    setForm(cloneContact(contact));
    setFieldName("");
    setFieldValue("");
    setStatus(`Editing ${displayName(contact)}`);
  }

  function addExtraField() {
    const name = fieldName.trim();
    if (!name) {
      setError("Custom field name is required.");
      return;
    }
    setForm((current) => ({
      ...current,
      extra_fields: {
        ...current.extra_fields,
        [name]: fieldValue.trim()
      }
    }));
    setFieldName("");
    setFieldValue("");
    setError("");
  }

  function removeExtraField(name) {
    setForm((current) => {
      const nextFields = { ...current.extra_fields };
      delete nextFields[name];
      return { ...current, extra_fields: nextFields };
    });
  }

  async function saveContact() {
    setSaving(true);
    setError("");
    try {
      if (selectedContactId) {
        const updated = await updateContact(apiBaseUrl, selectedContactId, form);
        setContacts((current) =>
          current.map((contact) => (contact.id === updated.id ? updated : contact))
        );
        setStatus(`Saved ${displayName(updated)}`);
      } else {
        const created = await createContact(apiBaseUrl, form);
        setContacts((current) => [created, ...current]);
        setSelectedContactId(created.id);
        setForm(cloneContact(created));
        setStatus(`Created ${displayName(created)}`);
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(contact) {
    Alert.alert("Delete contact", `Delete ${displayName(contact)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          setError("");
          try {
            await deleteContact(apiBaseUrl, contact.id);
            setContacts((current) => current.filter((item) => item.id !== contact.id));
            if (selectedContactId === contact.id) {
              startCreate();
            }
            setStatus("Contact deleted");
          } catch (deleteError) {
            setError(deleteError.message);
          } finally {
            setSaving(false);
          }
        }
      }
    ]);
  }

  async function testConnection() {
    setLoading(true);
    setError("");
    try {
      await checkReady(apiBaseUrl);
      setStatus("Backend is ready");
    } catch (readyError) {
      setError(readyError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Address Book</Text>
            <Text style={styles.subtitle}>Contacts synced with the Flask API</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Backend</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setApiBaseUrl}
              placeholder="API base URL"
              style={styles.input}
              value={apiBaseUrl}
            />
            <View style={styles.buttonRow}>
              <Button label="Check" onPress={testConnection} secondary />
              <Button label="Refresh" onPress={loadContacts} secondary />
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Search</Text>
            <TextInput
              onChangeText={(value) => setFilterValue("keyword", value)}
              placeholder="Keyword"
              style={styles.input}
              value={filters.keyword}
            />
            <View style={styles.twoColumn}>
              <TextInput
                onChangeText={(value) => setFilterValue("first_name", value)}
                placeholder="First name"
                style={[styles.input, styles.flexInput]}
                value={filters.first_name}
              />
              <TextInput
                onChangeText={(value) => setFilterValue("last_name", value)}
                placeholder="Last name"
                style={[styles.input, styles.flexInput]}
                value={filters.last_name}
              />
            </View>
            <TextInput
              onChangeText={(value) => setFilterValue("address", value)}
              placeholder="Address"
              style={styles.input}
              value={filters.address}
            />
            <View style={styles.buttonRow}>
              <Button label="Search" onPress={loadContacts} />
              <Button
                label="Clear"
                onPress={() => {
                  setFilters(EMPTY_FILTERS);
                  setStatus("Filters cleared");
                }}
                secondary
              />
            </View>
          </View>

          {(status || error) && (
            <View style={[styles.message, error ? styles.errorMessage : styles.statusMessage]}>
              <Text style={[styles.messageText, error ? styles.errorText : styles.statusText]}>
                {error || status}
              </Text>
            </View>
          )}

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading contacts</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contacts</Text>
            <Pressable onPress={startCreate} style={styles.iconButton}>
              <Text style={styles.iconButtonText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.list}>
            {contacts.map((contact) => (
              <Pressable
                key={contact.id}
                onPress={() => startEdit(contact)}
                style={[
                  styles.contactRow,
                  selectedContactId === contact.id && styles.contactRowSelected
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{contactInitials(contact)}</Text>
                </View>
                <View style={styles.contactBody}>
                  <Text style={styles.contactName}>{displayName(contact)}</Text>
                  <Text style={styles.contactMeta} numberOfLines={1}>
                    {contact.phone_number || "No phone"} · {contact.address || "No address"}
                  </Text>
                </View>
                <Pressable onPress={() => confirmDelete(contact)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </Pressable>
            ))}
            {!loading && contacts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No contacts found</Text>
                <Text style={styles.emptyText}>Add a contact or loosen the search filters.</Text>
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{selectedContact ? "Edit contact" : "New contact"}</Text>
            <View style={styles.twoColumn}>
              <TextInput
                onChangeText={(value) => setFormValue("first_name", value)}
                placeholder="First name"
                style={[styles.input, styles.flexInput]}
                value={form.first_name}
              />
              <TextInput
                onChangeText={(value) => setFormValue("last_name", value)}
                placeholder="Last name"
                style={[styles.input, styles.flexInput]}
                value={form.last_name}
              />
            </View>
            <TextInput
              keyboardType="phone-pad"
              onChangeText={(value) => setFormValue("phone_number", value)}
              placeholder="Phone number"
              style={styles.input}
              value={form.phone_number}
            />
            <TextInput
              multiline
              onChangeText={(value) => setFormValue("address", value)}
              placeholder="Address"
              style={[styles.input, styles.textArea]}
              value={form.address}
            />

            <Text style={styles.subheading}>Custom fields</Text>
            {Object.entries(form.extra_fields).map(([name, value]) => (
              <View key={name} style={styles.extraFieldRow}>
                <View style={styles.extraFieldCopy}>
                  <Text style={styles.extraFieldName}>{name}</Text>
                  <Text style={styles.extraFieldValue}>{value || "Empty"}</Text>
                </View>
                <Pressable onPress={() => removeExtraField(name)} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}

            <View style={styles.twoColumn}>
              <TextInput
                onChangeText={setFieldName}
                placeholder="Field name"
                style={[styles.input, styles.flexInput]}
                value={fieldName}
              />
              <TextInput
                onChangeText={setFieldValue}
                placeholder="Value"
                style={[styles.input, styles.flexInput]}
                value={fieldValue}
              />
            </View>
            <Button label="Add custom field" onPress={addExtraField} secondary />

            <View style={styles.buttonRow}>
              <Button
                disabled={saving}
                label={saving ? "Saving..." : selectedContact ? "Save changes" : "Create contact"}
                onPress={saveContact}
              />
              <Button label="New" onPress={startCreate} secondary />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Button({ disabled = false, label, onPress, secondary = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  keyboard: {
    flex: 1
  },
  container: {
    padding: 18,
    paddingBottom: 40
  },
  header: {
    paddingVertical: 12
  },
  title: {
    color: "#0f172a",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0
  },
  subtitle: {
    color: "#475569",
    fontSize: 15,
    marginTop: 4
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 14
  },
  panelTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 15,
    marginBottom: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  flexInput: {
    flex: 1
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: "top"
  },
  twoColumn: {
    columnGap: 10,
    flexDirection: "row"
  },
  buttonRow: {
    columnGap: 10,
    flexDirection: "row",
    marginTop: 2
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  secondaryButton: {
    backgroundColor: "#e0f2fe"
  },
  disabledButton: {
    opacity: 0.55
  },
  pressedButton: {
    opacity: 0.8
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700"
  },
  secondaryButtonText: {
    color: "#075985"
  },
  message: {
    borderRadius: 8,
    marginTop: 14,
    padding: 12
  },
  statusMessage: {
    backgroundColor: "#dcfce7"
  },
  errorMessage: {
    backgroundColor: "#fee2e2"
  },
  messageText: {
    fontSize: 14,
    fontWeight: "600"
  },
  statusText: {
    color: "#166534"
  },
  errorText: {
    color: "#991b1b"
  },
  loadingRow: {
    alignItems: "center",
    columnGap: 10,
    flexDirection: "row",
    marginTop: 16
  },
  loadingText: {
    color: "#475569",
    fontSize: 14
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 21,
    fontWeight: "800"
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  iconButtonText: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 30
  },
  list: {
    marginTop: 10,
    rowGap: 10
  },
  contactRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 12,
    flexDirection: "row",
    minHeight: 74,
    padding: 12
  },
  contactRowSelected: {
    borderColor: "#2563eb"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#fde68a",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  avatarText: {
    color: "#78350f",
    fontSize: 16,
    fontWeight: "800"
  },
  contactBody: {
    flex: 1,
    minWidth: 0
  },
  contactName: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800"
  },
  contactMeta: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  deleteButtonText: {
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "800"
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 22
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800"
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4,
    textAlign: "center"
  },
  subheading: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 2
  },
  extraFieldRow: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    columnGap: 10,
    flexDirection: "row",
    marginBottom: 8,
    padding: 10
  },
  extraFieldCopy: {
    flex: 1,
    minWidth: 0
  },
  extraFieldName: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800"
  },
  extraFieldValue: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 2
  },
  smallButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  smallButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800"
  }
});
