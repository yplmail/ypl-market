define(function (require, exports, module) {
    var Ajax = require('/component/ajax/ajax');
    var api = require('/config/api');
    var utils = require('/util/utils');
    var common = require('/module/common/common');
    var laypage = require('/component/pager/laypage');
    var detail = {
        init: function () {
            common.checkLoginStatus();
            this.productId = utils.getQueryString().productId;
            this.renderDetail();
            this.bindEvent();
        },
        /*
        * [绑定方法]
        * */
        bindEvent: function () {
            var self = this;
            $('#site-detailWrapper').on('click', '.productBuyButton', function () {
                self.orgNumber = $(this).attr('orgnumber');
                self.buyProductId = $(this).attr('productid');
                self.orgName = $(this).attr('orgname');
                self.buyProduct();
            });
        },
        renderDetail: function () {
            var self = this;
            var ajax = new Ajax();
            ajax.url = api.productDetail;
            ajax.data = {
                productId: self.productId
            };
            ajax.success = function (result) {
                var resultTpl = self.detailFilter(result);
                var detailTpl = $("#detailTpl").html();
                $("#site-detailWrapper").html(_.template(detailTpl)(resultTpl));
                $("#productMsg").html(result.productDesc).parent().removeClass("none");
                var rightHeight = $('.productBuyButton').outerHeight() + $('.attention').outerHeight() + $(".project-progress").outerHeight();
                $(".detail-enter").height(rightHeight);
            };
            ajax.request();
        },
        detailFilter: function (result) {
            result.orgLogo = config.imageUrl + result.orgInfoResponse.orgLogo + '?f=png';
            result.orgName = result.orgInfoResponse.orgName;
            result.tagListTpl = _.map(result.tagList, function (item) {
                return "<span>" + item + "</span>";
            }).join("\n");//自定义标签
            //剩余额度:总金额减去已购买金额
            result.remainingBalance = Math.round((result.buyTotalMoney - result.buyedTotalMoney) * 100) / 100;
            //选取金额限制(orgAmountLimit)和剩余金额(remainingBalance)中数值小的(在!空的情况下 如果为空 则去另外一个)
            result.orgAmountLimit = result.orgInfoResponse.orgAmountLimit;
            if (result.remainingBalance && (!result.orgAmountLimit)) {
                result.saleAmout = utils.formatAmount(result.remainingBalance);
            } else if (result.orgAmountLimit && (!result.remainingBalance)) {
                result.saleAmout = utils.formatAmount(result.orgAmountLimit);
            } else if (!(result.remainingBalance || result.orgAmountLimit)) {
                result.saleAmout = "不限";
            } else if (result.remainingBalance > result.orgAmountLimit * 1) {
                result.saleAmout = utils.formatAmount(result.orgAmountLimit);
            } else if (result.remainingBalance < result.orgAmountLimit * 1) {
                result.saleAmout = utils.formatAmount(result.remainingBalance);
            }
            //产品进度
            if (!result.isHaveProgress) {
                result.progressClass = "block";
                if (result.buyTotalMoney - result.buyedTotalMoney < 0) {
                    result.percentage = 100 + '%';
                } else {
                    result.buyedTotalMoney = result.buyedTotalMoney || 0;
                    result.buyTotalMoney = result.buyTotalMoney || 1;
                    result.percentage = parseInt(result.buyedTotalMoney / result.buyTotalMoney * 100) + "%";
                }
            } else {
                result.progressClass = "none";
                result.percentage = "";
            }
            //产品总额度
            result.buyTotalMoney = utils.formatAmount(Math.floor(result.buyTotalMoney / 10000)) + "<span>万</span>";
            //产品期限
            var deadLineArr = result.deadLineValueText.split(',');
            //固定期限
            if (deadLineArr.length === 2) {
                result.deadLineText = deadLineArr[0] + '<span>' + deadLineArr[1] + '</span>';
            }
            //浮动期限
            if (deadLineArr.length === 4) {
                result.deadLineText = deadLineArr[0] + '<span>' + deadLineArr[1] + '</span>~' + deadLineArr[2] + '<span>' + deadLineArr[3] + '</span>';
            }
            //年化收益
            if (result.isFlow == "1") {
                result.yearRate = result.flowMinRate.toFixed(2);
            } else {
                result.yearRate = result.flowMinRate.toFixed(2) + '~' + result.flowMaxRate.toFixed(2);
            }
            //购买人数
            result.buyedTotalPeople = utils.formatAmount(result.buyedTotalPeople, true);
            return result;
        },
        /**
         * 检测是否绑卡
         */
        buyProduct: function () {
            var self = this;
            var ajax = new Ajax();
            ajax.url = api.personAuthenticate;
            ajax.back = true;
            ajax.isNeedToken = true;
            ajax.async = false;
            ajax.success = function (result) {
                if (result.bundBankcard) {
                    self.checkAccount();
                } else {
                    layer.open({
                        type: 1,
                        title: '银行卡绑定提示',
                        closeBtn: true,
                        shadeClose: true,
                        // skin:'layui-layer-lan',
                        skin: 'yourclass',
                        area: ['600px', '400px'],
                        content: '<div style=" position: relative;top:50%;height:50%;margin-top:-5%;padding:0 30px;line-height:1.5em;font-size:16px;color:#969696"><span>绑定银行卡后才能购买产品，是否现在绑定银行卡？</span></div>',
                        btn: ['取消', '立即绑定'],
                        btn2: function () {
                            location.href = "/module/account/bindBankCard.html";
                        }
                    });
                }
            };
            ajax.request();
        },

        /**
         * 检查用户是否注册第三方
         * @return {[type]} [description]
         */
        checkAccount: function () {
            var self = this;
            var ajax = new Ajax();
            ajax.url = api.isBindOtherOrg;
            ajax.isNeedToken = true;
            ajax.async = false;
            ajax.data = {
                'platFromNumber': self.orgNumber
            };
            ajax.success = function (result) {
                if (result.isBind) {
                    self.skipThirdPlatform();
                } else {
                    self.registerThirdAccount();
                }
            };
            ajax.request();
        },

        /**
         * 注册第三方账户
         * @return {[type]} [description]
         */
        registerThirdAccount: function () {
            var self = this;
            layer.msg('正在为您注册' + self.orgName + '账户', {icon: 16, notimeout: true});
            var ajax = new Ajax();
            ajax.url = api.bindOrgAcct;
            ajax.isNeedToken = true;
            ajax.isLoadMask = false;
            ajax.async = false;
            ajax.data = {
                'platFromNumber': self.orgNumber
            };
            ajax.success = function (data) {
                layer.closeAll();
                self.skipThirdPlatform();
            };
            ajax.error = function (msg, data) {
                layer.closeAll();
                layer.msg(msg);
            };
            ajax.request();
        },

        /**
         * 获取参数跳转第三方
         * @return {[type]} [description]
         */
        skipThirdPlatform: function () {
            var tab = window.open('about:blank', '_blank');
            tab.location = "./thirdPlatform.html?productId=" + this.buyProductId + "&orgNo=" + this.orgNumber + "&orgName=" + this.orgName;
        }
    };

    detail.init();
});
