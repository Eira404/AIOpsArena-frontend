export default {
  InjectionDialog: {
    Experiment: 'Experiment',
    Schedule: 'Schedule',
    Single: '单次，选择故障注入时刻',
    Timer: '定时，crontab表达式，北京时间，10 5 * * *',
    SelectInjectionTiming: 'Select injection timing',
    Cancel: '取消',
    Confirm: '确认',
    Injection: '注入故障'
  },
  SelectFault: '选择需要注入的故障',
  Question:{
    Q1:  '1. 按住V键的同时，向上（向下）滚动或按+（-）可垂直放大（缩小）日历',
    Q2:  '2. 按住H键的同时，向上（向下）滚动或按+（-）可水平放大（缩小）日历',
    Q3:  '3. 拖动滚动条、滚动滚轮，或按住日历并移动鼠标以移动日历'
  },
  AllFaultsAreLoaded: '故障信息获取完成',
  LoadingDates: '加载日期',
  RenderingCompleted: '渲染完成',
  ErrorDates: '报错日期',
  DetailDialog: {
    FaultDetail: '故障详情',
    Type: '类型',
    Delete: '删除',
    Name: '名称',
    Timestamp: '时间戳',
    Duration: '持续时间',
    Cancel: '取消',
    Warning: '警告',
    DeletePrompt: '你确定要<span class="text-red-500">删除</span>故障',
    Q: '吗？',
    Ongoing: '请勿删除正在执行的故障'
  },
  PleaseSelectANamespace: {
    Microservice: '微服务',
    Testbed: '试验台',
    Or: '或',
    PLSGoto: '请前往',
    LastS: '创建微服务系统以获取Namespace'
  }
}
