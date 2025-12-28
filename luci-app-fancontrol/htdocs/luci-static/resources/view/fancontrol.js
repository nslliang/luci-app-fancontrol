'use strict';
'require view';
'require form';
'require uci';
'require rpc';

const THERMAL_FILE_PLACEHOLDER = '/sys/devices/virtual/thermal/thermal_zone0/temp';
const FAN_FILE_PLACEHOLDER = '/sys/devices/platform/pwm-fan/hwmon/hwmon1/pwm1';

// 使用 ubus 文件读取接口（取代 fs.read_direct）
const callFileRead = rpc.declare({
    object: 'file',
    method: 'read',
    params: ['path'],
    expect: { data: '' }
});

async function readFile(filePath) {
    if (!filePath) return null;
    try {
        const result = await callFileRead(filePath);
        if (result === undefined || result === null) return null;
        const value = parseInt(result.toString().trim());
        return isNaN(value) ? null : value;
    } catch (e) {
        console.error('readFile() failed:', filePath, e);
        return null;
    }
}

return view.extend({
    load: function() {
        return Promise.all([uci.load('fancontrol')]);
    },

    render: async function(data) {
        const m = new form.Map('fancontrol', _('Fan General Control'));

        const s = m.section(form.TypedSection, 'fancontrol', _('Settings'));
        s.anonymous = true;

        // 启用
        let o = s.option(form.Flag, 'enable', _('Enable'), _('Enable fan control service'));
        o.rmempty = false;

        // 温度
        const thermalPath = uci.get('fancontrol', 'settings', 'thermal_file') || THERMAL_FILE_PLACEHOLDER;
        const tempDiv = parseInt(uci.get('fancontrol', 'settings', 'temp_div')) || 1000;
        const temp = await readFile(thermalPath);

        o = s.option(form.Value, 'thermal_file', _('Thermal File'), _('Path to temperature sensor'));
        o.placeholder = THERMAL_FILE_PLACEHOLDER;
        if (temp !== null && tempDiv > 0)
            o.description = _('Current temperature:') + ` <b>${(temp / tempDiv).toFixed(2)}°C</b>`;
        else
            o.description = _('Error reading temperature or invalid temp_div');

        // 风扇
        const fanPath = uci.get('fancontrol', 'settings', 'fan_file') || FAN_FILE_PLACEHOLDER;
        const speed = await readFile(fanPath);

        o = s.option(form.Value, 'fan_file', _('Fan Speed File'), _('Path to fan speed control (PWM)'));
        o.placeholder = FAN_FILE_PLACEHOLDER;
        if (speed !== null)
            o.description = _('Current speed:') + ` <b>${(speed / 255 * 100).toFixed(1)}%</b> (${speed})`;
        else
            o.description = _('Error reading fan speed file');

        // 其他参数
        o = s.option(form.Value, 'temp_div', _('Temperature coefficient'), _('Default is 1000.'));
        o.placeholder = '1000';

        o = s.option(form.Value, 'start_speed', _('Initial Speed'), _('Fan startup duty (0–255).'));
        o.placeholder = '60';

        o = s.option(form.Value, 'max_speed', _('Max Speed'), _('Maximum duty (0–255).'));
        o.placeholder = '255';

        o = s.option(form.Value, 'start_temp', _('Start Temperature'), _('Temperature at which the fan starts.'));
        o.placeholder = '35';

        return m.render();
    }
});