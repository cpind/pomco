$(function(){

    $.ajaxSetup({
        headers:{"X-CSRFToken": Cookies.get('csrftoken')}
    });

    
    var url = window.pomcodata,
        $playserSelect = $('.players-select'),
        $playersList = $('.js-players-list'),
        currentTeam = null,
        $searchTeams = $('.js-search-teams'),
        totalNumberOfDays = 38,
        dataReadyDef = new $.Deferred(),
        membersToAdd = [],
        teamMembers = []//,
    ;


    //STATES
    var REMOVE = "remove",
        ADD = "add",
        MOVES = "moves",
        VIEW = "view";

    //current state
    var state = VIEW;


    //initial state
    $('.js-done').hide();
    

    $.ajax({
        type: "GET",
        url: url,
        dataType: "text",
        success: function(datacsv) {
            statsmpg.init(datacsv);
            players = statsmpg.playersAll;
            dataReadyDef.resolve();
        }
    });


    $('.js-teams-menu').on('click', function(){
        $('.teams-drawer').toggleClass('is-shown');
    });


    $(window).on('click', function(event){
        //        return;
        var $target = $(event.target);
        if( $target.hasClass('js-teams-menu') ||
            $target.parents('.teams-drawer').length ||
            $target.parents('.modal').length ||
            $target.hasClass('modal')) {
            return;
        }
        $('.teams-drawer').removeClass('is-shown');
    });


    //update content of the drawer according to the search input
    $searchTeams.on('input',  function(){
        var rawValue = $searchTeams.val(),
            value = rawValue.toLowerCase(),
            $teams = $('.teams-drawer-content>.teams-drawer-teams'),
            $result = $('.teams-drawer-content').children('.teams-drawer-search-result'),
            $addTeam = $('.teams-drawer-content .js-add-team');
        if( !value || value === "" ) {
            //reset placeholder
            $searchTeams.val("");
            $teams.show();
            $addTeam.show();
            $result.hide();
            return;
        }
        //generate search result
        $result.empty();
        $content = $teams.clone();
        $content.show();
        //removes section headers
        $content.find('.sidebar-section-header').remove();
        //keep only first ul
        $content.find('ul:not(:first)').remove();
        //clear ul items
        $ul = $content.find('.sidebar-teams-list');
        $ul.empty();
        //filter result
        $li = $teams.find('li.compact-team-tile').clone();
        var searchValues = prepareSearchValue(value);
        $li.filter(function(index, el){
            var raw_name = $(el).find('.compact-team-tile-link-text-name').text(),
                name = raw_name.toLowerCase(),
                match = false;
            for( var i = 0; i < searchValues.length; ++i ) {
                if( !(name.indexOf(searchValues[i]) > -1) ) {
                    return false;
                }
            }
            return true;
        }).appendTo($ul);
        $content.appendTo($result);
        var $addTeamWithName = $addTeam.clone();
        $addTeamWithName.show();
        $addTeamWithName.find('a').text("Create team name \""+ rawValue +"\"");
        $addTeamWithName.attr('data-name', rawValue);
        $addTeamWithName.appendTo($result);
        $addTeamWithName.removeClass('js-add-team');
        $addTeamWithName.addClass('js-add-team-with-name');
        $result.show();
        $teams.hide();
        $addTeam.hide();
    });

    function prepareSearchValue(value) {
        var vals = value.split(' '),
            res = [];
        for( var i = 0; i < vals.length; ++i ) {
            var val = vals[i];
            if( vals[i] === ' ' ) continue;
            res.push(val);
        }
        return res;
    }

    $('#createTeamModal').on('show.bs.modal', function(event){
        var button = $(event.relatedTarget);
        var name = button.data('name');
        if( !name || name === "") return;
        var modal = $(this);
        modal.find('#inputTeamName').val(name);
        
    })
    
    adjustDrawerHeight();
    refreshAggregates();
    $(window).resize(adjustDrawerHeight);
    

    function adjustDrawerHeight(){
        var topbarHeight =
            50 // topbar height
            + 15 // drawer margin top
            + 16 // content margin top
            + 10, // drawer margin bottom
            maxHeight = $(window).height() - topbarHeight;
        $('.teams-drawer-content').css('max-height', maxHeight);        
    }
    
    $('.js-validate-players').on('click', function(event){
        var $checked = $playersList.find('input:checked'),
            target = event.target,
            $target = $(target),
            url = target.dataset.url,
            members = $.map($checked, function(item){
                return $(item).val();
            });
        
        //update members on db
        saveMembers(members, url)
            .done(function(data){
                //clear the list
                $playersList.empty();
                $playserSelect.removeClass('show');
                currentTeam = data;
            });
    });


    var saveMembers = function(members, url){
        return $.ajax({
            type: "POST",
            url: url,
            dataType: "json",
            data:{members:JSON.stringify(members)}
        });
    };

    
    $('.js-add-player').on('click', function(event){
        var $target = event.target,
            jsonMembers = $target.dataset.members,
            teamIs = event.target.dataset.teamId;
        if( currentTeam ){
            jsonMembers = currentTeam.members;
        }
        var members = JSON.parse(jsonMembers);
        $div = $playersList;
        //clear the list, just-in-case
        $div.empty();
        $list = $('<ul></ul>');
        $div.append($list);
        for( var i = 0; i < players.length; ++i){
            var player = players[i],
                value = statsmpg.playerUID(player),
                checked = members.indexOf(value) > -1 ? 'checked=true' : '';
            $list.append(
                '<li>'
                    + '<input type="checkbox"'
                    + 'value="'+ value +'" '
                    + checked
                    + '"/>'
                    + '<span class="name">' + player.nom + '</span>'
                    + '<span class="team">' + player.team + '</span>'
                    + '</li>')
        }
        $playserSelect.addClass('show');
    });


    $('.js-done').on('click', function(event){
        var target = event.target,
            url = target.dataset.url,
            members = teamMembers,
            restoreTableau = true;
        if( !membersToAdd.length && (state != MOVES)) {
            return done();
        }
        if( state == REMOVE ) {
            members = members.filter(function(m){
                return membersToAdd.indexOf(m) == -1;
            });
            restoreTableau = false;
        } else if (state == MOVES) {
            members = tableau.members();
            d3.selectAll('g.season').classed('selected', false);
            restoreTableau = false;
        } else {
            members = members.concat(membersToAdd);
            d3.select('svg').classed('active', false);
        }
        saveMembers(members, url).done(done);
        function done() {
            teamMembers = members;
            $(event.target).hide();
            $('.js-edit').show();
            setMode(VIEW);
            if( restoreTableau ) {
                updateTableau({members:members});
            }
        }
    })


    $('.js-add-player2').on('click', function(event){
        setMode(ADD);
        teamMembers = tableau.members();
        updateTableau({click:function(m){
            membersToAdd.push(m);
            d3_remove_member(m);
        }});
    });


    $('.js-switch-to-remove-players').on('click', function(event){
        setMode(REMOVE);
        d3_season_on_click(
            //click:
            function(m){
                membersToAdd.push(m);
                d3_remove_member(m);
            }
        );
    });
    

    $('.js-switch-to-moves-players').on('click', function(event){
        var active = null,
            selection = d3.selectAll('svg .season');
        disableFilters();
        setMode(MOVES);
        selection
            .on('click',function(d, index, nodes){
                if( !d.id ) {
                    return;
                }
                if( !active ) {
                    active = d.id;
                    d3.select(this).classed('selected', true);
                    return;
                }
                if( active == d.id ) {
                    active = null;
                    d3.select(this).classed('selected', false);
                    return;
                }
                d3_switch_members($('.js-team-aggregate')[0], active, d.id);
            });
    });

    
    var setMode = function (mode) {
        state = mode;
        if( mode != VIEW ) {
            $('.js-edit').hide();
            $('.js-done').show();
            membersToAdd = [];
        }
        if( mode == VIEW) {
            enableFilters();
        }
    }
    
    
    //event
    $('.js-select-club').on('change', function(e){
        var $el = $(e.target),
            val = $el.val();
        updateTableau(); 
    });


    $('.js-select-poste').on('change', function(e){
        var $el = $(e.target),
            val = $el.val();
        updateTableau();
    });


    $('.js-search-name').on('input', function(e){
        var $el = $(e.target),
            val = $el.val();
        if(!val || val == ""){
            $el.val("");
        }
        updateTableau()
    })


    function clearFilters(){
        filterPoste(null);
        filterClub(null);
        filterName('');
        updateTableau({members:teamMembers});
    }
    
    function disableFilters() {
        clearFilters();
        enableFilters(false);
    }

    function enableFilters(enabled){
        var disabled = (enabled == null) ? false: !enabled;
        $('.js-select-poste button').prop('disabled', disabled)
        $('.js-select-club button').prop('disabled', disabled)
        $('.js-search-name').prop('disabled', disabled)
    }

    function tableauOptions(){
        return $('.js-team-aggregate').data('tableau-options');
    }
    
    function updateTableau(opt){
        var opt = opt || {};
        $('.js-team-aggregate').each(function(index, el){
            var $el = $(el),
                options = $el.data('tableau-options'),
                //TODO: clarify option settings
                members = opt.members || options.members,
                detail = options.detail,
                cardHeight = options.cardHeight;
            tableau_update(teamMembers, {
                click:opt.click,
                detail:detail,
                excludeMembers: (state == ADD),
                filterPoste: filterPoste(),
                filterClub: filterClub(),
                filterName: filterName()
            });
        });
    }

    //TODO: replicate to other filters
    function filterPoste(val){
        var args = ['val'].concat(Array.prototype.slice.call(arguments));
        return $.fn.selectpicker.apply($('.js-select-poste'), args);
    }

    function filterClub(val){
        var args = ['val'].concat(Array.prototype.slice.call(arguments));
        return $.fn.selectpicker.apply($('.js-select-club'), args);
    }


    function filterName(val){
        var args = Array.prototype.slice.call(arguments);
        return $.fn.val.apply($('.js-search-name'), args);
    }

    //tableau
    function refreshAggregates(){
        $('.js-team-aggregate').each(function(index, el){
            var members = JSON.parse(el.dataset.members),
                detail = el.dataset.detail || true;
            if( detail == "false")
                detail = false;
            members = members.filter(function(m){return m;});
            teamMembers = members;
            $.when(dataReadyDef).done(function(){
                tableauInit(el, {
                    members:members,
                    detail: detail,
                    height: 50,
                    width:$(el).width()
                });
            });
        });
    }

    function tableauInit(el, opt){
        return tableau.init(el, opt);
    }

});

