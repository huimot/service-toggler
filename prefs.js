import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Widgets from './preferenceswidget.js';
import {AboutPage} from './aboutpage.js';
import * as DialogWidgets from './dialogwidgets.js';

const WireGuarIndicatorPreferencesWidget = GObject.registerClass(
    class WireGuarIndicatorPreferencesWidget extends Widgets.ListWithStack {
        _init(ext) {
            super._init({});
            const settings = ext.getSettings();

            const keyLabel = _("Name");
            const valueLabel = _("Service");

            const nmcliFrame = new Widgets.Frame({ marginBottom: 15 });
            const nmcliSection = this.addFrameHelper(new Widgets.Page(), _("nmcli"), nmcliFrame);
            nmcliSection.addGSetting(settings, "nmcli");

            const preferencesPage = nmcliSection.page;

            const sudoFrame = new Widgets.Frame({ marginBottom: 15 });
            const sudoSection = preferencesPage.addFrame(_("Sudo"), sudoFrame);
            sudoSection.addGSetting(settings, "sudo");

            let servicesSection = new Widgets.ArrayKeyValueSetting(
                settings, "services", keyLabel, valueLabel);
            preferencesPage.addFrame(_("Services"), servicesSection);

            const addServicesSection = preferencesPage.addFrame("");
            const buttonAdd = new Gtk.Button({
                iconName: 'list-add-symbolic',
                hexpand: true,
                vexpand: false,
                halign: Gtk.Align.END,
                valign: Gtk.Align.CENTER,
            });
            buttonAdd.connect('clicked', () => {
                const dialog = new DialogWidgets.KeyValueDialog(
                    this, _("Add"), keyLabel, valueLabel);
                dialog.connect("response", (widget, response_id) => {
                    const new_name = dialog.getKey();
                    const new_service = dialog.getValue();
                    if (response_id == Gtk.ResponseType.OK) {
                        servicesSection.addRow(new_name, new_service);
                        servicesSection.updateSettings();
                    }
                    dialog.hide();
                    dialog.destroy();
                });
                dialog.show();
            });
            addServicesSection.addWidget(_("Add more services"), buttonAdd);

            const updateSensitivity = () => {
                const value = !settings.get_boolean("nmcli");
                sudoSection.set_sensitive(value);
                servicesSection.set_sensitive(value);
                addServicesSection.set_sensitive(value);
            };
            updateSensitivity();
            settings.connect("changed::nmcli", updateSensitivity);

            const checkPage = new Widgets.Page();
            const checkSection = checkPage.addFrame(_("Check time"));
            checkSection.addWidgetSetting(
                settings, "checktime",
                new Widgets.NumberSetting(settings, "checktime", 5, 60 * 100));

            const themePage = new Widgets.Page();
            const styleSection = themePage.addFrame(_("Theme"));
            styleSection.addGSetting(settings, "darktheme");

            this.add(_("WireGuard Preferences"), "preferences-other-symbolic", preferencesPage);
            this.add(_("Check time"), "preferences-system-time-symbolic", checkPage);
            this.add(_("Style"), "applications-graphics-symbolic", themePage);
            this.add(_("About"), "help-about-symbolic", new AboutPage(ext));
        }

        addFrameHelper(page, title, frame) {
            const sec = page.addFrame(title, frame);
            sec.page = page;
            return sec;
        }
    }
);

export default class WireGuardIndicatorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(850, 700);
        const widget = new WireGuarIndicatorPreferencesWidget(this);
        window.set_content(widget);
    }
}
