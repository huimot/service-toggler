import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

function getNMCliServices() {
    const services = [];
    try {
        let [, stdout, stderr, status] = GLib.spawn_command_line_sync('nmcli c show');
        const decoder = new TextDecoder();
        if (status !== 0) {
            throw new Error(decoder.decode(stderr));
        }
        stdout = decoder.decode(stdout);

        const lines = stdout.split('\n');
        const name_length = lines[0].indexOf('UUID');
        const uuid_length = lines[0].indexOf('TYPE');
        const type_length = lines[0].indexOf('DEVICE');
        for (let i = 1; i < lines.length; i++) {
            const name = lines[i].substring(0, name_length).trim();
            const uuid = lines[i].substring(name_length, uuid_length).trim();
            const type = lines[i].substring(uuid_length, type_length).trim();
            if (type == "wireguard") {
                services.push(`${name}|${uuid}`);
            }
        }
    } catch (e) {
        logError(e);
    }
    return services;
}

const WireGuardIndicator = GObject.registerClass(
    class WireGuardIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "WireGuard Indicator", false);
            this._extension = extension;
            this._settings = extension.getSettings();
            this._isActive = null;

            let box = new St.BoxLayout();
            this.icon = new St.Icon({style_class: 'system-status-icon'});
            box.add_child(this.icon);
            this.add_child(box);

            this.services_section = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this.services_section);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
            this.settingsMenuItem.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(this.settingsMenuItem);

            this._sourceId = 0;
            this._settingsChanged();
            this._settingsId = this._settings.connect('changed', this._settingsChanged.bind(this));
        }

        _loadConfiguration() {
            this._usenmcli = this._getValue('nmcli');
            if (this._usenmcli) {
                this._services = getNMCliServices();
            } else {
                this._services = this._getValue('services');
            }
            this._usesudo = this._getValue('sudo');
            this._checktime = this._getValue('checktime');
            if (this._checktime < 5) {
                this._checktime = 5;
            } else if (this._checktime > 600) {
                this._checktime = 600;
            }
            this._servicesSwitches = [];
            this.services_section.actor.hide();
            if (this.services_section.numMenuItems > 0) {
                this.services_section.removeAll();
            }
            this._services.forEach((item) => {
                let [name, service] = item.split('|');
                let serviceSwitch = new PopupMenu.PopupSwitchMenuItem(name, false);
                serviceSwitch.label.set_name(service);
                serviceSwitch._toggleId = serviceSwitch.connect('toggled', this._toggleSwitch.bind(this));
                this._servicesSwitches.push(serviceSwitch);
                this.services_section.addMenuItem(serviceSwitch);
                this.services_section.actor.show();
            });
        }

        _checkStatus() {
            let isActive = this._servicesSwitches.some(s => s.state);
            if (this._isActive === null || this._isActive !== isActive) {
                this._isActive = isActive;
                this._set_icon_indicator(this._isActive);
            }
        }

        _toggleSwitch(widget, value) {
            try {
                let service = widget.label.get_name();
                let command;
                if (this._usenmcli) {
                    const setstatus = value ? 'up' : 'down';
                    command = ['nmcli', 'c', setstatus, 'uuid', service];
                } else {
                    const setstatus = value ? 'start' : 'stop';
                    command = ['systemctl', setstatus, service];
                    if (this._usesudo) {
                        command.unshift('pkexec');
                    }
                }
                let proc = Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        proc.communicate_utf8_finish(res);
                        this._update();
                    } catch (e) {
                        logError(e);
                    }
                });
            } catch (e) {
                logError(e);
            }
        }

        _getValue(keyName) {
            return this._settings.get_value(keyName).deep_unpack();
        }

        _update() {
            this._servicesSwitches.forEach((serviceSwitch) => {
                let service = serviceSwitch.label.name;
                try {
                    let command = this._usenmcli
                        ? ['nmcli', 'c', 'show', '--active', 'uuid', service]
                        : ['systemctl', 'is-active', service];
                    let proc = Gio.Subprocess.new(
                        command,
                        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    );
                    proc.communicate_utf8_async(null, null, (proc, res) => {
                        try {
                            let [, stdout] = proc.communicate_utf8_finish(res);
                            let active = this._usenmcli
                                ? stdout.trim().length > 0
                                : stdout.trim() === 'active';
                            serviceSwitch.block_signal_handler(serviceSwitch._toggleId);
                            serviceSwitch.setToggleState(active);
                            serviceSwitch.unblock_signal_handler(serviceSwitch._toggleId);
                            this._checkStatus();
                        } catch (e) {
                            logError(e);
                        }
                    });
                } catch (e) {
                    logError(e);
                }
            });
            return true;
        }

        _set_icon_indicator(active) {
            let darktheme = this._getValue('darktheme');
            let theme_string = darktheme ? 'dark' : 'light';
            let status_string = active ? 'active' : 'paused';
            let icon_string = `wireguard-${status_string}-${theme_string}`;
            this.icon.set_gicon(this._get_icon(icon_string));
        }

        _get_icon(icon_name) {
            let base_icon = `${this._extension.path}/icons/${icon_name}`;
            let file_icon = Gio.File.new_for_path(`${base_icon}.png`);
            if (!file_icon.query_exists(null)) {
                file_icon = Gio.File.new_for_path(`${base_icon}.svg`);
            }
            if (!file_icon.query_exists(null)) {
                return Gio.icon_new_for_string('network-vpn-symbolic');
            }
            return Gio.icon_new_for_string(file_icon.get_path());
        }

        _settingsChanged() {
            this._loadConfiguration();
            this._update();
            if (this._sourceId > 0) {
                GLib.source_remove(this._sourceId);
            }
            this._sourceId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, this._checktime,
                this._update.bind(this));
        }

        destroy() {
            if (this._sourceId > 0) {
                GLib.source_remove(this._sourceId);
                this._sourceId = 0;
            }
            if (this._settingsId) {
                this._settings.disconnect(this._settingsId);
            }
            super.destroy();
        }
    }
);

export default class WireGuardIndicatorExtension extends Extension {
    enable() {
        this._indicator = new WireGuardIndicator(this);
        // Позиция 'right', индекс 1 — ставит иконку сразу справа от часов
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
