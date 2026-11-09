import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from './AuthContext';

export function AccountSettingsPage() {
  const { profile, updateProfile } = useAuth();
  const creator = profile?.role === 'creator';
  const initial = profile?.profile || {};
  const [name, setName] = useState(String(initial[creator ? 'public_name' : 'business_name'] || profile?.displayName || ''));
  const [url, setUrl] = useState(String(initial[creator ? 'channel_url' : 'website_url'] || ''));
  const [bio, setBio] = useState(String(initial.biography || ''));
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    try {
      await updateProfile(creator
        ? { public_name: name.trim(), channel_url: url.trim() || null, biography: bio.trim() }
        : { business_name: name.trim(), website_url: url.trim() || null });
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  }
  return <div>
    <PageHeader eyebrow="ACCOUNT SETTINGS" title={creator ? 'Creator profile' : 'Retailer profile'} description="These fields are saved to the profile owned by your signed-in BopIt account." />
    <section className="auth-card settings-card">
      <p><strong>Email</strong><br />{profile?.email || 'Not available'}<br /><small>Email changes are managed by Supabase Auth.</small></p>
      <p><strong>Account type</strong><br />{creator ? 'Creator' : 'Retailer'}<br /><small>Account type cannot be changed from profile settings.</small></p>
      <form className="auth-form" onSubmit={submit}>
        <label>{creator ? 'Public creator name' : 'Business name'}<input required maxLength={creator ? 120 : 160} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>{creator ? 'Channel URL' : 'Website URL'}<input type="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" /></label>
        {creator && <label>Biography<textarea maxLength={4000} rows={5} value={bio} onChange={event => setBio(event.target.value)} /></label>}
        {error && <p role="alert" className="auth-alert">{error}</p>}{saved && <p role="status" className="auth-success">Profile saved.</p>}
        <button disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </section>
  </div>;
}
